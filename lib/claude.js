import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-5';

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Один вызов Claude со структурированным ответом по JSON-схеме
export async function askClaude(env, { system, content, schema, maxTokens = 8000 }) {
  if (!env.ANTHROPIC_API_KEY) throw new ApiError(500, 'Не настроен ключ Claude');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new ApiError(429, 'Слишком много запросов, попробуйте через минуту');
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status, error.message);
      throw new ApiError(502, 'Сервис рецептов временно недоступен');
    }
    throw error;
  }
  console.log('usage', JSON.stringify(response.usage));
  if (response.stop_reason === 'refusal') throw new ApiError(422, 'Не получилось обработать запрос');
  if (response.stop_reason === 'max_tokens') throw new ApiError(502, 'Ответ получился слишком длинным, попробуйте ещё раз');
  const text = response.content.find((block) => block.type === 'text')?.text;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, 'Не удалось разобрать ответ');
  }
}

export function errorResponse(error) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: 'Что-то пошло не так, попробуйте ещё раз' }, 500);
}
