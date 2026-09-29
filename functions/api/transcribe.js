import { json } from '../../lib/claude.js';

const MAX_BYTES = 1024 * 1024; // 20 с записи — 50–320 КБ

// btoa от всей строки сразу переполняет стек — собираем кусками по 32 КБ
function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function onRequestPost({ request, env }) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('audio/')) return json({ error: 'Ожидается аудиозапись' }, 400);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return json({ error: 'Пустая запись' }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: 'Запись слишком длинная' }, 413);
  if (!env.AI) return json({ error: 'На сервере не подключён Workers AI' }, 500);

  try {
    // vad_filter: без него на тишине Whisper сочиняет «Продолжение следует...»
    const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: toBase64(bytes),
      language: 'ru',
      vad_filter: true,
    });
    return json({ text: (out?.text || '').trim() });
  } catch (error) {
    console.error('whisper failed', error);
    return json({ error: 'Не получилось распознать запись, попробуйте ещё раз' }, 502);
  }
}
