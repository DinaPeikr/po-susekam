<template>
  <main class="favorites-page">
    <div class="favorites">
      <h1 class="favorites__title">Избранное</h1>
      <p v-if="!favorites.list.length" class="favorites__empty">
        Здесь пока пусто. Нажмите ♡ на фото рецепта, чтобы сохранить его.
        <RouterLink :to="{ name: 'home' }">Подобрать рецепты</RouterLink>
      </p>
      <template v-else>
        <p class="favorites__hint">{{ countText }} · сохранены в этом браузере</p>
        <TransitionGroup tag="div" name="fade" class="favorites__grid">
          <RecipeCard v-for="recipe in favorites.list" :key="recipe.slug" :recipe="recipe" />
        </TransitionGroup>
      </template>
    </div>
  </main>
</template>

<script>
import RecipeCard from '@/components/RecipeCard.vue';
import { favorites } from '@/stores/favorites.js';

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export default {
  name: 'FavoritesPage',
  components: { RecipeCard },
  data() {
    return { favorites };
  },
  computed: {
    countText() {
      const n = this.favorites.list.length;
      return `${n} ${plural(n, 'рецепт', 'рецепта', 'рецептов')}`;
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/FavoritesPage.scss"></style>
