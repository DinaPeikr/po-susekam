<template>
  <main class="home">
    <RecipeSearch
      v-model="search.ingredients"
      :loading="loading"
      :status="status"
      @search="find"
      @clear="clear"
      @status="status = $event"
    />

    <template v-if="showResults">
      <h2 class="home__heading">Что можно приготовить</h2>
      <p v-if="isEmpty" class="home__empty">
        Из этих продуктов не получилось подобрать блюда. Добавьте что-нибудь съедобное и попробуйте ещё раз.
      </p>
      <RecipeCarousel v-if="!isEmpty" ref="carousel" class="home__carousel">
        <template v-if="loading">
          <div v-for="n in 3" :key="`skeleton-${n}`" class="skeleton" aria-hidden="true" />
        </template>
        <RecipeCard v-for="recipe in search.results" :key="recipe.slug" :recipe="recipe" />
        <div v-for="n in (loadingMore ? 3 : 0)" :key="`more-${n}`" class="skeleton" aria-hidden="true" />
      </RecipeCarousel>
      <div v-if="hasResults" class="home__more">
        <button
          class="home__more-button"
          :class="{ 'is-exhausted': !search.canLoadMore && !loadingMore }"
          type="button"
          :disabled="loadingMore || !search.canLoadMore"
          @click="loadMore"
        >
          <span v-if="loadingMore" class="home__spinner" aria-hidden="true" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>
          Ещё рецепты
        </button>
        <p class="home__more-status" role="status">{{ moreStatus }}</p>
      </div>
    </template>
  </main>
</template>

<script>
import RecipeSearch from '@/components/RecipeSearch.vue';
import RecipeCarousel from '@/components/RecipeCarousel.vue';
import RecipeCard from '@/components/RecipeCard.vue';
import { search } from '@/stores/search.js';
import { loadPhotos } from '@/utils/loadPhotos.js';

export default {
  name: 'HomePage',
  components: { RecipeSearch, RecipeCarousel, RecipeCard },
  data() {
    return {
      search,
      loading: false,
      loadingMore: false,
      moreError: '',
      status: { text: '', error: false },
    };
  },
  computed: {
    hasResults() {
      return this.search.results.length > 0;
    },
    showResults() {
      return this.loading || this.hasResults || this.search.searched;
    },
    moreStatus() {
      if (this.loadingMore) return 'Подбираем ещё — обычно 15–25 секунд';
      if (this.moreError) return this.moreError;
      if (!this.search.canLoadMore) return 'Лимит подбора исчерпан — выберите из этих рецептов или измените продукты и начните новый поиск';
      return '';
    },
    isEmpty() {
      return !this.loading && !this.hasResults && this.search.searched;
    },
  },
  mounted() {
    // После F5 или возврата с рецепта догружаем фото, которые не пришли
    loadPhotos(this.search.results);
  },
  watch: {
    // Удалили последний продукт — рецепты к нему больше не относятся
    'search.ingredients'(list) {
      if (!list.length) this.resetSearch();
    },
  },
  methods: {
    resetSearch() {
      // Лишнее присваивание дёрнуло бы watch стора и запись в sessionStorage
      if (this.search.results.length) this.search.results = [];
      this.search.searched = false;
      this.search.canLoadMore = false;
      this.moreError = '';
      this.requestId = (this.requestId || 0) + 1;
      this.loading = false;
      this.loadingMore = false;
    },

    clear() {
      if (this.search.ingredients.length) this.search.ingredients = [];
      this.resetSearch();
      this.status = { text: '', error: false };
    },

    async requestRecipes(exclude) {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: this.search.ingredients, exclude }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'Не получилось подобрать блюда, попробуйте ещё раз');
        error.limitReached = data.limitReached;
        throw error;
      }
      return data;
    },

    toRecipes(list, offset) {
      return list.map((recipe, index) => ({
        ...recipe,
        slug: `ai-${offset + index + 1}`,
        photo: null,
        photoStatus: 'idle',
      }));
    },

    async find() {
      if (this.loading) return;
      if (!this.search.ingredients.length) {
        this.status = { text: 'Добавьте хотя бы один продукт', error: true };
        return;
      }
      this.resetSearch();
      const id = this.requestId;
      this.loading = true;
      this.status = { text: 'Обычно это занимает 15–25 секунд', error: false };
      try {
        const data = await this.requestRecipes([]);
        if (id !== this.requestId) return;
        this.search.results = this.toRecipes(data.recipes, 0);
        this.search.canLoadMore = data.canLoadMore;
        this.search.searched = true;
        this.status = { text: '', error: false };
        loadPhotos(this.search.results);
      } catch (error) {
        if (id !== this.requestId) return;
        this.status = { text: error.message, error: true };
      } finally {
        if (id === this.requestId) this.loading = false;
      }
    },

    async loadMore() {
      if (this.loadingMore || !this.search.canLoadMore) return;
      const id = this.requestId;
      const firstNew = this.search.results.length;
      this.loadingMore = true;
      this.moreError = '';
      // Скелетоны в конце карусели — сразу показываем, куда придут новые рецепты
      await this.$nextTick();
      this.$refs.carousel?.scrollToIndex(firstNew);
      try {
        const data = await this.requestRecipes(this.search.results.map((recipe) => recipe.title));
        if (id !== this.requestId) return;
        this.search.results = [...this.search.results, ...this.toRecipes(data.recipes, firstNew)];
        this.search.canLoadMore = data.canLoadMore;
        this.loadingMore = false;
        await this.$nextTick();
        this.$refs.carousel?.scrollToIndex(firstNew);
        loadPhotos(this.search.results);
      } catch (error) {
        if (id !== this.requestId) return;
        if (error.limitReached) this.search.canLoadMore = false;
        else this.moreError = error.message;
      } finally {
        if (id === this.requestId) this.loadingMore = false;
      }
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/HomePage.scss"></style>
