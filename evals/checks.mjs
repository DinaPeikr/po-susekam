// Проверки ответа /api/recipes. Каждая возвращает null (прошла) или строку — что именно не так.
// Проверки только кодом, без второй модели: дёшево, быстро и одинаково на каждом прогоне.

const COUNT = 6;
// Эти продукты «есть всегда» по системному промпту — в missing им не место
const STAPLES = /^(соль|перец|черный перец|чёрный перец|вода|сахар|растительное масло|масло растительное|подсолнечное масло)$/;

const lower = (value) => String(value).toLowerCase().replace(/ё/g, 'е');

// Корень слова: «картошка» → «карто», «яйца» → «яйц». Грубо, но для «есть ли продукт в тексте» хватает
const stem = (word) => {
  const w = lower(word);
  return w.slice(0, Math.min(5, Math.max(3, w.length - 2)));
};
const stemsOf = (list) => list.flatMap((item) => lower(item).split(/\s+/)).filter((w) => w.length > 2).map(stem);

// Для missing — совпадение корня слова целиком: иначе «рисовый уксус» засчитывается как «рис»
const sameWord = (text, stems) => lower(text).split(/\s+/).some((w) => stems.includes(stem(w)));
const has = (text, stems) => stems.some((s) => lower(text).includes(s));
const cyrillic = (text) => /[а-яё]/i.test(text);

// Общие проверки для кейсов, где рецепты должны быть
const general = {
  'ровно 6 рецептов': (recipes) => (recipes.length === COUNT ? null : `пришло ${recipes.length}`),

  'названия не повторяются': (recipes) => {
    const titles = recipes.map((r) => lower(r.title));
    const dup = titles.find((t, i) => titles.indexOf(t) !== i);
    return dup ? `дубль «${dup}»` : null;
  },

  'текст по-русски': (recipes) => {
    const bad = recipes.find((r) => !cyrillic(r.title) || !cyrillic(r.description));
    return bad ? `«${bad.title}»` : null;
  },

  'калорий столько же, сколько ингредиентов': (recipes) => {
    const bad = recipes.find((r) => r.ingredient_calories.length !== r.ingredients.length);
    return bad ? `«${bad.title}»: ${bad.ingredients.length} ингр. / ${bad.ingredient_calories.length} ккал` : null;
  },

  // Нижняя граница низкая: салат из огурцов и помидоров честно даёт 30–40 ккал
  'ккал на порцию в разумных пределах (20–1500)': (recipes) => {
    const bad = recipes.find((r) => r.calories_per_serving < 20 || r.calories_per_serving > 1500);
    return bad ? `«${bad.title}»: ${bad.calories_per_serving} ккал` : null;
  },

  'image_query: 2–4 английских слова': (recipes) => {
    const bad = recipes.find((r) => {
      const words = r.image_query.trim().split(/\s+/);
      return words.length < 2 || words.length > 4 || !/^[a-z\s'-]+$/i.test(r.image_query);
    });
    return bad ? `«${bad.image_query}»` : null;
  },

  'шаги без нумерации': (recipes) => {
    for (const r of recipes) {
      const step = r.steps.find((s) => /^\s*(\d+\s*[.)]|шаг\s*\d)/i.test(s));
      if (step) return `«${r.title}»: «${step.slice(0, 40)}…»`;
    }
    return null;
  },

  'в missing нет продуктов пользователя': (recipes, testCase) => {
    const stems = testCase.stems || stemsOf(testCase.ingredients);
    for (const r of recipes) {
      const item = r.missing.find((m) => sameWord(m, stems));
      if (item) return `«${r.title}»: missing «${item}»`;
    }
    return null;
  },

  'в missing нет соли, перца, воды, сахара, масла': (recipes) => {
    for (const r of recipes) {
      const item = r.missing.find((m) => STAPLES.test(lower(m).trim()));
      if (item) return `«${r.title}»: missing «${item}»`;
    }
    return null;
  },

  'каждое блюдо из продуктов пользователя': (recipes, testCase) => {
    const stems = testCase.stems || stemsOf(testCase.ingredients);
    const bad = recipes.find((r) => !has(r.ingredients.join(' '), stems));
    return bad ? `«${bad.title}» — ни одного продукта из запроса` : null;
  },
};

// Возвращает [{ name, error }] — по одной записи на каждую применимую проверку
export function runChecks(testCase, response) {
  const results = [];
  const add = (name, error) => results.push({ name, error });

  if (response.status !== 200) {
    add('ответ 200', `HTTP ${response.status}: ${response.body?.error}`);
    return results;
  }
  const recipes = response.body.recipes || [];
  const expect = testCase.expect || {};

  if (expect.empty) {
    add('несъедобное → пустой ответ', recipes.length ? `пришло ${recipes.length}: ${recipes.map((r) => r.title).join('; ')}` : null);
    return results;
  }

  for (const [name, check] of Object.entries(general)) add(name, check(recipes, testCase));

  if (expect.forbid) {
    const bad = recipes.find((r) => has(r.ingredients.join(' '), expect.forbid));
    add('несъедобное не попало в ингредиенты', bad ? `«${bad.title}»: ${bad.ingredients.join(', ')}` : null);
  }

  if (testCase.exclude) {
    const excluded = testCase.exclude.map(lower);
    const bad = recipes.find((r) => excluded.includes(lower(r.title)) || has(r.title, expect.forbidTitle || []));
    add('exclude: показанные блюда не повторяются', bad ? `«${bad.title}»` : null);
  }

  return results;
}
