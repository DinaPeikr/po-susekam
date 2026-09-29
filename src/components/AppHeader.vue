<template>
  <header class="header" :class="{ 'is-scrolled': scrolled, 'has-back': showBack }">
    <div class="header__inner">
      <RouterLink class="logo" :to="{ name: 'home' }" aria-label="По сусекам — на главную">
        <svg class="logo__icon" viewBox="0 0 48 56" width="26" height="30" aria-hidden="true">
          <path class="logo__hat" d="M13 17c-4.5 0-7-3.2-7-6.5S8.8 4 12.5 4.6C13.8 2 16.6 0.5 19.5 1c1.6-0.7 3.3-1 5-1 2.7 0 5.2 1 6.8 2.6C34 1.8 37 2.6 38.6 5c3.4 0.4 5.4 3 5.4 6 0 3.4-2.7 6-7 6z" />
          <rect class="logo__hat-band" x="12" y="15" width="26" height="5" rx="1.5" />
          <rect class="logo__fridge" x="10" y="21" width="30" height="33" rx="5" />
          <path class="logo__line" d="M10 33h30M15 26v4M15 37v7" />
          <circle class="logo__eye" cx="21" cy="46" r="1.6" />
          <circle class="logo__eye" cx="31" cy="46" r="1.6" />
          <path class="logo__smile" d="M23 49.5q3 2.5 6 0" />
        </svg>
        <span class="logo__text">
          <span class="logo__name">По сусекам</span>
          <span class="logo__slogan">Шедевры из того, что есть в холодильнике</span>
        </span>
      </RouterLink>

      <div class="header__actions">
        <RouterLink v-if="showBack" class="back" :to="back.to">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          <span>Назад<span class="back__long">&nbsp;{{ back.tail }}</span></span>
        </RouterLink>
        <RouterLink
          class="fav-link"
          :class="{ 'is-current': $route.name === 'favorites' }"
          :to="{ name: 'favorites' }"
          :aria-label="`Избранное: ${favoritesCount}`"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 4.5 7.1 4.5c2 0 3.5 1.1 4.9 2.9 1.4-1.8 2.9-2.9 4.9-2.9 3.5 0 5.4 3.5 4.3 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" /></svg>
          <span class="fav-link__text">Избранное</span>
          <span v-if="favoritesCount" class="fav-link__count">{{ favoritesCount }}</span>
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<script>
import { favorites } from '@/stores/favorites.js';

export default {
  name: 'AppHeader',
  data() {
    return { scrolled: false };
  },
  computed: {
    favoritesCount() {
      return favorites.list.length;
    },
    showBack() {
      return this.$route.name === 'recipe' || this.$route.name === 'favorites';
    },
    // С рецепта, открытого из избранного, возвращаемся в избранное
    back() {
      const fromFavorites = this.$route.name === 'recipe' && String(this.$route.params.slug).startsWith('fav-');
      return fromFavorites
        ? { to: { name: 'favorites' }, tail: 'к избранному' }
        : { to: { name: 'home' }, tail: 'к рецептам' };
    },
  },
  mounted() {
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.onScroll);
  },
  methods: {
    onScroll() {
      this.scrolled = window.scrollY > 8;
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/AppHeader.scss"></style>
