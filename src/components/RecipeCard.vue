<template>
  <article class="card">
    <img
      v-if="image"
      class="card__image"
      :src="image"
      :alt="recipe.photo.alt || recipe.title"
      loading="lazy"
      draggable="false"
    >
    <div v-else class="card__image card__image--placeholder" aria-hidden="true">🍽️</div>
    <FavoriteButton class="card__favorite" :recipe="recipe" />
    <div class="card__body">
      <h2 class="card__title">{{ recipe.title }}</h2>
      <p class="card__text">{{ recipe.description }}</p>
      <p v-if="meta" class="card__meta">{{ meta }}</p>
      <RouterLink class="card__button" :to="{ name: 'recipe', params: { slug: recipe.slug } }" draggable="false">
        Смотреть рецепт
      </RouterLink>
    </div>
  </article>
</template>

<script>
import FavoriteButton from './FavoriteButton.vue';
import { photoUrl } from '@/utils/photo.js';

export default {
  name: 'RecipeCard',
  components: { FavoriteButton },
  props: {
    recipe: { type: Object, required: true },
  },
  computed: {
    image() {
      return photoUrl(this.recipe.photo, 560, 240);
    },
    meta() {
      const parts = [];
      if (this.recipe.time_minutes) parts.push(`⏱ ${this.recipe.time_minutes} мин`);
      if (this.recipe.calories_per_serving) parts.push(`≈ ${this.recipe.calories_per_serving} ккал`);
      const missing = this.recipe.missing || [];
      parts.push(missing.length ? `не хватает: ${missing.join(', ')}` : 'всё есть');
      return parts.join(' · ');
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/RecipeCard.scss"></style>
