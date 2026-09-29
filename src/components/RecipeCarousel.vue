<template>
  <div class="carousel">
    <section class="carousel__section" aria-label="Рецепты">
      <div
        ref="track"
        class="carousel__track"
        :class="{ 'is-scrollable': canScroll, 'is-dragging': isDragging }"
        @scroll.passive="update"
        @pointerdown="onPointerDown"
        @dragstart.prevent
      >
        <slot />
      </div>
    </section>
    <div
      ref="bar"
      class="carousel__scrollbar"
      :class="{ 'is-scrollable': canScroll }"
      aria-hidden="true"
      @pointerdown="onBarDown"
    >
      <div ref="thumb" class="carousel__thumb" :style="{ transform: `translateX(${thumbX}px)` }" />
    </div>
  </div>
</template>

<script>
const DRAG_THRESHOLD = 5;
const SWIPE_DISTANCE = 50;

export default {
  name: 'RecipeCarousel',
  data() {
    return { canScroll: false, isDragging: false, thumbX: 0 };
  },
  mounted() {
    this.drag = null;
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(this.$refs.track);
    // Карточки и скелетоны приходят через слот — пересчитываем при каждом изменении списка
    this.mutationObserver = new MutationObserver(() => this.update());
    this.mutationObserver.observe(this.$refs.track, { childList: true });
    this.update();
  },
  beforeUnmount() {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    clearTimeout(this.snapTimer);
  },
  methods: {
    update() {
      const { track, bar, thumb } = this.$refs;
      if (!track) return;
      const max = track.scrollWidth - track.clientWidth;
      this.canScroll = max > 1;
      const free = bar.clientWidth - thumb.offsetWidth;
      this.thumbX = this.canScroll ? (track.scrollLeft / max) * free : 0;
    },

    // Точки остановки — от первой карточки, а не от scroll-padding: там строка max(…) и parseFloat даёт NaN
    stops() {
      const { track } = this.$refs;
      const cards = [...track.children];
      if (!cards.length) return [0];
      const max = track.scrollWidth - track.clientWidth;
      return cards.map((card) => Math.min(Math.max(card.offsetLeft - cards[0].offsetLeft, 0), max));
    },

    // Доводим сами плавной прокруткой: snap при отпускании прыгает на 100+ px за кадр
    settle(left) {
      const { track } = this.$refs;
      const restore = () => {
        clearTimeout(this.snapTimer);
        track.removeEventListener('scrollend', restore);
        track.style.scrollSnapType = '';
      };
      track.addEventListener('scrollend', restore);
      this.snapTimer = setTimeout(restore, 700);
      track.scrollTo({ left, behavior: 'smooth' });
    },

    scrollToIndex(index) {
      const { track } = this.$refs;
      const stop = this.stops()[index];
      if (stop === undefined) return;
      track.style.scrollSnapType = 'none';
      this.settle(stop);
    },

    // Мышь тащит трек через JS; тач скроллит нативно
    onPointerDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !this.canScroll) return;
      const { track } = this.$refs;
      this.drag = { startX: event.clientX, startLeft: track.scrollLeft, pointerId: event.pointerId, moved: false };
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
    },

    onPointerMove(event) {
      const { drag } = this;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        drag.moved = true;
        this.isDragging = true;
        clearTimeout(this.snapTimer);
        this.$refs.track.style.scrollSnapType = 'none';
      }
      this.$refs.track.scrollLeft = drag.startLeft - dx;
    },

    onPointerUp(event) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      const { drag } = this;
      this.drag = null;
      if (!drag?.moved) return;
      this.isDragging = false;

      const { track } = this.$refs;
      const current = track.scrollLeft;
      const stops = this.stops();
      const gesture = drag.startX - event.clientX; // > 0 — тянули влево, едем вперёд
      let target;
      if (gesture > SWIPE_DISTANCE) {
        target = stops.find((stop) => stop > current + 1) ?? stops[stops.length - 1];
      } else if (gesture < -SWIPE_DISTANCE) {
        target = [...stops].reverse().find((stop) => stop < current - 1) ?? 0;
      } else {
        target = stops.reduce((best, stop) => (Math.abs(stop - current) < Math.abs(best - current) ? stop : best));
      }
      this.settle(target);

      // После перетаскивания браузер пришлёт click — он не должен открыть рецепт
      const block = (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      track.addEventListener('click', block, { capture: true, once: true });
      setTimeout(() => track.removeEventListener('click', block, { capture: true }), 100);
    },

    // Клик и перетаскивание по своему скроллбару
    onBarDown(event) {
      if (!this.canScroll) return;
      const { bar } = this.$refs;
      bar.setPointerCapture(event.pointerId);
      const move = (moveEvent) => this.scrollFromBar(moveEvent.clientX);
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
      this.scrollFromBar(event.clientX);
    },

    scrollFromBar(clientX) {
      const { track, bar, thumb } = this.$refs;
      const rect = bar.getBoundingClientRect();
      const free = rect.width - thumb.offsetWidth;
      const ratio = Math.min(Math.max((clientX - rect.left - thumb.offsetWidth / 2) / free, 0), 1);
      track.scrollLeft = ratio * (track.scrollWidth - track.clientWidth);
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/RecipeCarousel.scss"></style>
