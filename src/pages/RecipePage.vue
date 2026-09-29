<template>
  <main class="recipe-page">
    <RecipeDetail v-if="recipe" :key="recipe.slug" :recipe="recipe" />
    <div v-else class="recipe-page__empty">
      <h1>Рецепт не найден</h1>
      <RouterLink :to="{ name: 'home' }">Подобрать рецепты</RouterLink>
    </div>
  </main>
</template>

<script>
import RecipeDetail from '@/components/RecipeDetail.vue';
import { findRecipe } from '@/utils/findRecipe.js';

export default {
  name: 'RecipePage',
  components: { RecipeDetail },
  computed: {
    recipe() {
      return findRecipe(this.$route.params.slug);
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/RecipePage.scss"></style>
