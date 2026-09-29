<template>
  <button
    class="favorite"
    :class="[`favorite--${variant}`, { 'is-active': active }]"
    type="button"
    :aria-pressed="active"
    :aria-label="variant === 'icon' ? (active ? 'Убрать из избранного' : 'В избранное') : null"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 4.5 7.1 4.5c2 0 3.5 1.1 4.9 2.9 1.4-1.8 2.9-2.9 4.9-2.9 3.5 0 5.4 3.5 4.3 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" /></svg>
    <span v-if="variant === 'pill'">{{ active ? 'В избранном' : 'В избранное' }}</span>
  </button>
</template>

<script>
import { favorites } from '@/stores/favorites.js';

export default {
  name: 'FavoriteButton',
  props: {
    recipe: { type: Object, required: true },
    variant: { type: String, default: 'icon' },
  },
  computed: {
    active() {
      return favorites.has(this.recipe);
    },
  },
  methods: {
    // Кнопка лежит над растянутой ссылкой карточки — клик не должен открыть рецепт
    toggle(event) {
      event.preventDefault();
      event.stopPropagation();
      favorites.toggle(this.recipe);
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/FavoriteButton.scss"></style>
