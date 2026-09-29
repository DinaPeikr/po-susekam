import { search } from '@/stores/search.js';
import { favorites } from '@/stores/favorites.js';

// Сначала результаты поиска, потом избранное (slug fav-…)
export function findRecipe(slug) {
  return search.results.find((recipe) => recipe.slug === slug) || favorites.find(slug) || null;
}
