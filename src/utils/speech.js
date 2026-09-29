// Голосовой ввод: Web Speech там, где он работает (Chrome, Edge, Safari),
// иначе — запись через MediaRecorder и Whisper на сервере (/api/transcribe): Firefox, Brave.
// Интерфейс один: listen({ lang, onInterim, onProcessing }) → { result: Promise<string>, stop(), abort() }

const NO_SPEECH = 'Ничего не услышали, попробуйте ещё раз';
const SILENCE_AFTER_SPEECH = 2500;
const NO_SPEECH_LIMIT = 8000;
const MAX_DURATION = 20000;
const VOICE_RMS = 0.02; // порог голоса — подобран на живом микрофоне в Firefox

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
const canRecord = Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
  && typeof MediaRecorder !== 'undefined' && AudioContextClass);

// ?voice=record — сразу запасной путь, чтобы проверить его в Chrome
const forceRecord = typeof location !== 'undefined' && new URLSearchParams(location.search).get('voice') === 'record';
// Brave: Web Speech есть, но падает с network — в этой вкладке дальше сразу пишем звук
let webSpeechBroken = false;

export const speechSupported = Boolean(Recognition) || canRecord;

export function listen(options) {
  if (Recognition && !forceRecord && !webSpeechBroken) return listenWebSpeech(options);
  if (canRecord) return listenRecording(options);
  return { result: Promise.reject(new Error('Этот браузер не умеет записывать звук')), stop() {}, abort() {} };
}

function listenWebSpeech(options) {
  const { lang = 'ru-RU', onInterim } = options;
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  let transcript = '';
  let errorCode = '';
  let fallback = null; // сессия записи, если Web Speech упал
  let silenceTimer;
  const stopSoon = () => recognition.stop();
  const maxTimer = setTimeout(stopSoon, MAX_DURATION);

  const result = new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      transcript = [...event.results].map((item) => item[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
      onInterim?.(transcript);
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(stopSoon, SILENCE_AFTER_SPEECH);
    };
    recognition.onerror = (event) => {
      errorCode = event.error;
    };
    recognition.onend = () => {
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
      if (errorCode === 'network' && navigator.onLine && canRecord && !transcript) {
        webSpeechBroken = true;
        fallback = listenRecording(options);
        resolve(fallback.result);
        return;
      }
      if (transcript) {
        resolve(transcript);
        return;
      }
      const messages = {
        'not-allowed': 'Нет доступа к микрофону — разрешите его в настройках браузера',
        'service-not-allowed': 'Нет доступа к микрофону — разрешите его в настройках браузера',
        'audio-capture': 'Микрофон не найден — проверьте, что он подключён',
        'no-speech': NO_SPEECH,
        network: 'Голосовой ввод не работает без интернета — напишите продукты вручную',
        aborted: '',
      };
      const message = messages[errorCode] ?? (errorCode ? 'Не получилось распознать речь, попробуйте ещё раз' : NO_SPEECH);
      if (message) reject(new Error(message));
      else resolve('');
    };
  });

  try {
    recognition.start();
  } catch {
    return { result: Promise.reject(new Error('Не получилось включить микрофон')), stop() {}, abort() {} };
  }

  return {
    result,
    stop: () => (fallback ? fallback.stop() : recognition.stop()),
    abort: () => {
      if (fallback) {
        fallback.abort();
        return;
      }
      recognition.onend = null;
      recognition.abort();
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
    },
  };
}

function pickMimeType() {
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function listenRecording({ onInterim, onProcessing }) {
  // AudioContext создаём синхронно в обработчике клика, до await: иначе Safari оставит его на паузе
  const context = new AudioContextClass();
  context.resume();

  let finish = null; // появится, когда микрофон разрешён
  let cancelled = false;
  let aborted = false;

  const result = (async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      context.close().catch(() => {});
      if (cancelled) return '';
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        throw new Error('Нет доступа к микрофону — разрешите его в настройках браузера');
      }
      throw new Error('Микрофон не найден — проверьте, что он подключён');
    }
    // Нажали «Готово», пока браузер спрашивал разрешение, — просто отменяем
    if (cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
      return '';
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const startedAt = Date.now();
    let heardVoice = false;
    let lastVoiceAt = 0;
    let manual = false;

    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    finish = (byUser = false) => {
      if (recorder.state === 'inactive') return;
      manual = byUser;
      clearInterval(meter);
      recorder.stop();
    };

    // Тишину меряем сами: у MediaRecorder нет распознавания конца фразы
    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      const now = Date.now();
      if (rms > VOICE_RMS) {
        heardVoice = true;
        lastVoiceAt = now;
      }
      if ((heardVoice && now - lastVoiceAt > SILENCE_AFTER_SPEECH)
        || (!heardVoice && now - startedAt > NO_SPEECH_LIMIT)
        || now - startedAt > MAX_DURATION) finish();
    }, 100);

    recorder.start();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    context.close().catch(() => {});

    if (aborted) return '';
    // 8 с тишины — на сервер не ходим, Whisper тут ничего не даст
    if (!heardVoice && !manual) throw new Error(NO_SPEECH);

    onProcessing?.();
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': blob.type.split(';')[0] },
      body: blob,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не получилось распознать запись, попробуйте ещё раз');
    const text = (data.text || '').trim();
    if (!text) throw new Error(NO_SPEECH);
    onInterim?.(text);
    return text;
  })();

  return {
    result,
    stop: () => {
      if (finish) finish(true);
      else cancelled = true;
    },
    abort: () => {
      aborted = true;
      cancelled = true;
      finish?.();
    },
  };
}
