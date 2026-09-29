import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/recipes/:slug', name: 'recipe', component: () => import('./pages/RecipePage.vue') },
    { path: '/favorites', name: 'favorites', component: () => import('./pages/FavoritesPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 };
  },
});
