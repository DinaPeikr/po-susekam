import { reactive } from 'vue';

const KEY = 'favorites';
const LIMIT = 100;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Короткий стабильный хэш названия: один и тот же рецепт из разных поисков — один slug
function hash(text) {
  let h = 5381;
  for (const char of text.toLowerCase().trim()) h = ((h * 33) ^ char.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

const sameTitle = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const favorites = reactive({
  list: read(),

  has(recipe) {
    return this.list.some((item) => sameTitle(item.title, recipe.title));
  },

  find(slug) {
    return this.list.find((item) => item.slug === slug);
  },

  toggle(recipe) {
    if (this.has(recipe)) {
      this.list = this.list.filter((item) => !sameTitle(item.title, recipe.title));
    } else {
      // Копия целиком: рецепт из поиска исчезнет после нового поиска, а в избранном должен жить
      const copy = JSON.parse(JSON.stringify(recipe));
      copy.slug = `fav-${hash(recipe.title)}`;
      this.list = [copy, ...this.list].slice(0, LIMIT);
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch {
      // Переполнено или приватный режим — избранное живёт до перезагрузки
    }
  },
});

// Избранное поменяли в другой вкладке — подхватываем
window.addEventListener('storage', (event) => {
  if (event.key === KEY) favorites.list = read();
});
