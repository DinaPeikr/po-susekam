import { reactive, watch } from 'vue';

const KEY = 'recipe-search';

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

const saved = read();

// Состояние поиска переживает F5 и переход на страницу рецепта
export const search = reactive({
  ingredients: saved.ingredients || [],
  results: saved.results || [],
  canLoadMore: saved.canLoadMore || false,
  searched: saved.searched || false,
});

watch(search, () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(search));
  } catch {
    // Приватный режим Safari — без сохранения
  }
}, { deep: true });
