<template>
  <article class="recipe">
    <div class="recipe__media">
      <img v-if="heroImage" class="recipe__hero" :src="heroImage" :alt="recipe.photo.alt || recipe.title">
      <div v-else class="recipe__hero recipe__hero--placeholder" aria-hidden="true">🍽️</div>
      <div class="recipe__actions">
        <button v-if="recipe.steps?.length" class="recipe__action is-primary" type="button" @click="cooking = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          Готовить по шагам
        </button>
        <a class="recipe__action" :href="youtubeUrl" target="_blank" rel="noopener">
          <svg class="recipe__youtube" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" /></svg>
          Видео на YouTube
        </a>
        <FavoriteButton :recipe="recipe" variant="pill" />
      </div>
    </div>
    <CookingMode v-if="cooking" :recipe="recipe" @close="cooking = false" />
    <p v-if="recipe.photo" class="recipe__credit">
      Фото: <a :href="recipe.photo.authorUrl" target="_blank" rel="noopener">{{ recipe.photo.author }}</a>
      / <a :href="recipe.photo.sourceUrl" target="_blank" rel="noopener">{{ recipe.photo.sourceName }}</a>
    </p>

    <header class="recipe__header">
      <h1 class="recipe__title">{{ recipe.title }}</h1>
      <p class="recipe__lead">{{ recipe.description }}</p>
      <ul v-if="facts.length" class="recipe__facts">
        <li v-for="fact in facts" :key="fact">{{ fact }}</li>
      </ul>
    </header>

    <section>
      <h2 class="recipe__section-title">Ингредиенты</h2>
      <ol class="recipe__ingredients recipe__ingredients--compact">
        <li v-for="(item, index) in recipe.ingredients" :key="index">{{ item }}</li>
      </ol>
    </section>

    <section>
      <h2 class="recipe__section-title">Приготовление</h2>
      <ol class="recipe__steps recipe__steps--list">
        <li v-for="(step, index) in recipe.steps" :key="index">{{ step }}</li>
      </ol>
      <p v-if="recipe.tip" class="recipe__tip"><strong>Совет:</strong> {{ recipe.tip }}</p>
    </section>
  </article>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import FavoriteButton from './FavoriteButton.vue';
import { photoUrl } from '@/utils/photo.js';
import { loadPhotos } from '@/utils/loadPhotos.js';
import { search } from '@/stores/search.js';

export default {
  name: 'RecipeDetail',
  components: {
    FavoriteButton,
    // Пошаговый режим нужен не всем — грузим по нажатию
    CookingMode: defineAsyncComponent(() => import('./CookingMode.vue')),
  },
  props: {
    recipe: { type: Object, required: true },
  },
  data() {
    return { cooking: false };
  },
  computed: {
    heroImage() {
      return photoUrl(this.recipe.photo, 1280, 720);
    },
    youtubeUrl() {
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${this.recipe.title} рецепт`)}`;
    },
    facts() {
      const { time_minutes: time, servings, calories_per_serving: calories, missing = [] } = this.recipe;
      const facts = [];
      if (time) facts.push(`⏱ ${time} мин`);
      if (servings) facts.push(`🍽 ${servings} порц.`);
      if (calories) facts.push(`🔥 ≈ ${calories} ккал на порцию`);
      facts.push(missing.length ? `Не хватает: ${missing.join(', ')}` : 'Все продукты есть');
      return facts;
    },
  },
  mounted() {
    // Фото не успело догрузиться на главной — пробуем ещё раз, не повторяя чужие снимки
    if (!this.recipe.photo) {
      loadPhotos(search.results.includes(this.recipe) ? search.results : [this.recipe]);
    }
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/RecipeDetail.scss"></style>
