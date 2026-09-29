<template>
  <Transition name="scroll-top">
    <button v-if="visible" class="scroll-top" type="button" aria-label="Наверх" @click="toTop">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  </Transition>
</template>

<script>
export default {
  name: 'ScrollTopButton',
  data() {
    return { visible: false };
  },
  mounted() {
    window.addEventListener('scroll', this.onScroll, { passive: true });
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.onScroll);
  },
  methods: {
    onScroll() {
      this.visible = window.scrollY > 400;
    },
    toTop() {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/ScrollTopButton.scss"></style>
