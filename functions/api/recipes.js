import { askClaude, errorResponse, json } from '../../lib/claude.js';

// Порядок полей важен: модель пишет по порядку, калории считает, уже зная ингредиенты
const recipeSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    time_minutes: { type: 'integer' },
    servings: { type: 'integer' },
    ingredients: { type: 'array', items: { type: 'string' } },
    ingredient_calories: { type: 'array', items: { type: 'integer' } },
    missing: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    tip: { type: 'string' },
    image_query: { type: 'string' },
  },
  required: ['title', 'description', 'time_minutes', 'servings', 'ingredients', 'ingredient_calories', 'missing', 'steps', 'tip', 'image_query'],
  additionalProperties: false,
};

const schema = {
  type: 'object',
  properties: { recipes: { type: 'array', items: recipeSchema } },
  required: ['recipes'],
  additionalProperties: false,
};

const systemPrompt = (count) => `Ты — шеф домашней кухни. Пользователь перечисляет продукты, которые есть у него дома.
Предложи ${count} разных блюд — от простых и быстрых до чуть более интересных. Всё — по-русски.
- Соль, перец, растительное масло, вода и сахар есть всегда — их можно использовать, в missing не писать.
- Основа блюда — продукты пользователя. Если блюду чего-то не хватает, перечисли это в missing (коротко, без количества). Всё есть — пустой missing.
- ingredients — с количеством на указанное число порций.
- ingredient_calories — калории каждого пункта ingredients в том же порядке и того же количества элементов, для указанного количества. Макароны, крупы и мука — по сухому весу. Соль, специи и вода — 0.
- steps — понятные шаги без нумерации, с временем и температурой, где это важно.
- tip — один полезный совет к блюду.
- image_query — 2–4 слова по-английски для поиска фото готового блюда.
- description — одно-два предложения, аппетитно и по делу.
- Несъедобное в списке (камни, бумага, клей и т. п.) молча пропусти и готовь из остальных продуктов — даже если съедобный всего один.
- Пустой recipes — только если съедобного нет совсем.`;

const clean = (list) => (Array.isArray(list) ? list : [])
  .filter((item) => typeof item === 'string')
  .map((item) => item.trim().slice(0, 80))
  .filter(Boolean);

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const ingredients = clean(body.ingredients).slice(0, 30);
    const exclude = clean(body.exclude).slice(0, 60);
    if (!ingredients.length) return json({ error: 'Добавьте хотя бы один продукт' }, 400);

    const count = Number(env.RECIPES_COUNT) || 6;
    const rounds = Number(env.SEARCH_ROUNDS) || 2;
    // Лимит проверяем до Claude: исчерпанный лимит не стоит ни токенов, ни фото
    const round = Math.floor(exclude.length / count) + 1;
    if (round > rounds) return json({ error: 'Лимит подбора исчерпан', limitReached: true }, 429);

    let content = `Продукты: ${ingredients.join(', ')}.`;
    if (exclude.length) content += `\nЭти блюда я уже видел, предложи другие: ${exclude.join('; ')}.`;

    const data = await askClaude(env, { system: systemPrompt(count), content, schema });

    // Калории на порцию считаем сами: на effort low модель складывает на глаз и занижает
    const recipes = (data.recipes || []).slice(0, count).map((recipe) => {
      const total = (recipe.ingredient_calories || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const servings = Math.max(1, recipe.servings || 1);
      return { ...recipe, calories_per_serving: Math.round(total / servings / 10) * 10 };
    });

    return json({ recipes, canLoadMore: round < rounds });
  } catch (error) {
    return errorResponse(error);
  }
}
