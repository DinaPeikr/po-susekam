import { askClaude, errorResponse, json } from '../../lib/claude.js';

const schema = {
  type: 'object',
  properties: { ingredients: { type: 'array', items: { type: 'string' } } },
  required: ['ingredients'],
  additionalProperties: false,
};

const RULES = `Верни список продуктов по-русски, в нижнем регистре, общими названиями («сыр», а не марка),
без количества и единиц. Ничего не выдумывай: только то, что точно есть. Несъедобное пропусти. Нет продуктов — пустой список.`;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE = 5 * 1024 * 1024; // лимит Claude на картинку — 5 МБ в base64
const MAX_TEXT = 1000;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    let system;
    let content;

    if (typeof body.image === 'string' && body.image) {
      if (!IMAGE_TYPES.includes(body.mediaType)) return json({ error: 'Попробуйте JPG или PNG' }, 400);
      if (body.image.length > MAX_IMAGE) return json({ error: 'Фото слишком большое' }, 413);
      system = `Ты распознаёшь продукты на фото холодильника, стола или полки. ${RULES}`;
      content = [
        { type: 'image', source: { type: 'base64', media_type: body.mediaType, data: body.image } },
        { type: 'text', text: 'Какие продукты на фото?' },
      ];
    } else if (typeof body.text === 'string' && body.text.trim()) {
      if (body.text.length > MAX_TEXT) return json({ error: 'Слишком длинная фраза' }, 413);
      system = `Ты вытаскиваешь продукты из фразы, которую человек продиктовал. Текст распознан автоматически,
без препинания и с ошибками — исправь явные ошибки распознавания. ${RULES}`;
      content = body.text.trim();
    } else {
      return json({ error: 'Нужно фото или текст' }, 400);
    }

    const data = await askClaude(env, { system, content, schema, maxTokens: 1000 });
    const ingredients = (data.ingredients || [])
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30);
    return json({ ingredients });
  } catch (error) {
    return errorResponse(error);
  }
}
