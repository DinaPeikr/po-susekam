<template>
  <dialog ref="dialog" class="cooking" aria-label="Пошаговый режим" @cancel.prevent="close" @keydown="onKey">
    <div class="cooking__backdrop" :style="backdropStyle" />
    <div class="cooking__inner">
      <header class="cooking__top">
        <p class="cooking__title">{{ recipe.title }}</p>
        <button
          v-for="item in otherTimers"
          :key="item.index"
          class="cooking__mini-timer"
          :class="{ 'is-done': item.done }"
          type="button"
          :title="`Шаг ${item.index + 1}`"
          @click="go(item.index)"
        >
          {{ item.done ? `Шаг ${item.index + 1}: готово` : `Шаг ${item.index + 1} · ${item.time}` }}
        </button>
        <button class="cooking__close" type="button" aria-label="Закрыть" @click="close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div class="cooking__progress">
        <p>Шаг {{ current + 1 }} из {{ steps.length }} · {{ step.label }}</p>
        <div class="cooking__bar">
          <div class="cooking__bar-fill" :style="{ width: `${((current + 1) / steps.length) * 100}%` }" />
        </div>
      </div>

      <section class="cooking__stage" aria-live="polite" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <Transition :name="direction" mode="out-in">
          <div :key="current" class="cooking__step">
            <span class="cooking__icon" aria-hidden="true">{{ step.icon }}</span>
            <p class="cooking__text">{{ step.text }}</p>
            <div v-if="step.timerSeconds" class="cooking__timer">
              <template v-if="currentTimer">
                <p class="cooking__time" :class="{ 'is-done': currentTimer.done }">
                  {{ currentTimer.done ? 'Время вышло!' : format(timerLeft(currentTimer)) }}
                </p>
                <div class="cooking__timer-actions">
                  <button v-if="!currentTimer.done" class="cooking__chip" type="button" @click="togglePause(current)">
                    {{ currentTimer.pausedLeft !== null ? 'Продолжить' : 'Пауза' }}
                  </button>
                  <button class="cooking__chip" type="button" @click="resetTimer(current)">
                    {{ currentTimer.done ? 'Понятно' : 'Сбросить' }}
                  </button>
                </div>
              </template>
              <button v-else class="cooking__start" type="button" @click="startTimer(current)">
                Запустить таймер · {{ format(step.timerSeconds) }}
              </button>
            </div>
            <p v-if="isLast && recipe.tip" class="cooking__tip"><strong>Совет:</strong> {{ recipe.tip }}</p>
          </div>
        </Transition>
      </section>

      <footer class="cooking__nav">
        <button class="cooking__nav-button" type="button" :disabled="current === 0" @click="prev">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Назад
        </button>
        <button v-if="!isLast" class="cooking__nav-button is-primary" type="button" @click="next">
          Далее
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button v-else class="cooking__nav-button is-primary" type="button" @click="close">
          Готово — приятного аппетита!
        </button>
      </footer>
    </div>
  </dialog>
</template>

<script>
import { stepKind, stepTimer, formatTime } from '@/utils/steps.js';
import { photoUrl } from '@/utils/photo.js';

export default {
  name: 'CookingMode',
  props: {
    recipe: { type: Object, required: true },
  },
  emits: ['close'],
  data() {
    return {
      current: 0,
      direction: 'step-next',
      // Таймеры по номеру шага: можно варить и жарить одновременно
      timers: {},
      now: Date.now(),
    };
  },
  computed: {
    steps() {
      return (this.recipe.steps || []).map((text) => ({ text, ...stepKind(text), timerSeconds: stepTimer(text) }));
    },
    step() {
      return this.steps[this.current];
    },
    isLast() {
      return this.current === this.steps.length - 1;
    },
    currentTimer() {
      return this.timers[this.current] || null;
    },
    otherTimers() {
      return Object.entries(this.timers)
        .filter(([index]) => Number(index) !== this.current)
        .map(([index, timer]) => ({ index: Number(index), done: timer.done, time: this.format(this.timerLeft(timer)) }));
    },
    backdropStyle() {
      const image = photoUrl(this.recipe.photo, 640, 360);
      return image ? { backgroundImage: `url("${image}")` } : null;
    },
  },
  mounted() {
    this.$refs.dialog.showModal();
    this.ticker = setInterval(this.tick, 250);
    this.requestWakeLock();
    document.addEventListener('visibilitychange', this.onVisibility);
  },
  beforeUnmount() {
    clearInterval(this.ticker);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.wakeLock?.release().catch(() => {});
    this.audio?.close().catch(() => {});
  },
  methods: {
    format: formatTime,

    close() {
      this.$emit('close');
    },
    go(index) {
      if (index < 0 || index >= this.steps.length || index === this.current) return;
      this.direction = index > this.current ? 'step-next' : 'step-prev';
      this.current = index;
    },
    next() {
      this.go(this.current + 1);
    },
    prev() {
      this.go(this.current - 1);
    },
    onKey(event) {
      if (event.key === 'ArrowRight') this.next();
      if (event.key === 'ArrowLeft') this.prev();
    },
    onTouchStart(event) {
      const [touch] = event.changedTouches;
      this.touch = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd(event) {
      if (!this.touch) return;
      const [touch] = event.changedTouches;
      const dx = touch.clientX - this.touch.x;
      const dy = touch.clientY - this.touch.y;
      this.touch = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) this.next();
      else this.prev();
    },

    // Время считаем от endAt, а не тиками: вкладка в фоне тормозит setInterval
    timerLeft(timer) {
      if (timer.pausedLeft !== null) return timer.pausedLeft;
      return Math.max(0, (timer.endAt - this.now) / 1000);
    },
    startTimer(index) {
      // Safari даёт звук только из AudioContext, созданного по нажатию
      if (!this.audio) {
        const Context = window.AudioContext || window.webkitAudioContext;
        this.audio = Context ? new Context() : null;
      }
      this.audio?.resume();
      this.timers[index] = { endAt: Date.now() + this.steps[index].timerSeconds * 1000, pausedLeft: null, done: false };
    },
    togglePause(index) {
      const timer = this.timers[index];
      if (timer.pausedLeft !== null) {
        timer.endAt = Date.now() + timer.pausedLeft * 1000;
        timer.pausedLeft = null;
      } else {
        timer.pausedLeft = this.timerLeft(timer);
      }
    },
    resetTimer(index) {
      delete this.timers[index];
    },
    tick() {
      this.now = Date.now();
      for (const timer of Object.values(this.timers)) {
        if (!timer.done && timer.pausedLeft === null && timer.endAt <= this.now) {
          timer.done = true;
          this.ring();
        }
      }
    },
    ring() {
      navigator.vibrate?.([300, 150, 300, 150, 300]);
      if (!this.audio) return;
      const start = this.audio.currentTime;
      for (let i = 0; i < 3; i += 1) {
        const oscillator = this.audio.createOscillator();
        const gain = this.audio.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, start + i * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.45 + 0.3);
        oscillator.connect(gain).connect(this.audio.destination);
        oscillator.start(start + i * 0.45);
        oscillator.stop(start + i * 0.45 + 0.3);
      }
    },

    // Экран не гаснет, пока готовим с мокрыми руками
    async requestWakeLock() {
      try {
        this.wakeLock = await navigator.wakeLock?.request('screen');
      } catch {
        // Нет поддержки или батарея экономит — не критично
      }
    },
    onVisibility() {
      if (document.visibilityState === 'visible') this.requestWakeLock();
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/CookingMode.scss"></style>
