// Проверки ответа /api/recognize. Каждая возвращает null (прошла) или строку — что не так.
// Нижний регистр и обрезку проверять не нужно: их делает сам обработчик, а не модель.

const norm = (value) => String(value).toLowerCase().replace(/ё/g, 'е');
const matches = (item, stems) => stems.some((s) => norm(item).includes(norm(s)));

// \b в JS не работает с кириллицей — границы слова через (?<![а-я])…(?![а-я])
const UNITS = /(?<![а-я])(полкило|кило\w*|килограмм\w*|грамм\w*|литр\w*|штук\w*|пачк\w*|пар[аыу]|кг|г|л|шт)(?![а-я])/;

const general = {
  'без количества и единиц': (items) => {
    const bad = items.find((i) => /\d/.test(i) || UNITS.test(norm(i)));
    return bad ? `«${bad}»` : null;
  },
  'по-русски': (items) => {
    const bad = items.find((i) => !/^[а-яё\s-]+$/i.test(i));
    return bad ? `«${bad}»` : null;
  },
  'без дублей': (items) => {
    const dup = items.find((item, i) => items.indexOf(item) !== i);
    return dup ? `«${dup}»` : null;
  },
  // Ловит «камни песок вода» одним чипсом: общее название продукта — 1–3 слова
  'каждый продукт отдельно (≤ 3 слов)': (items) => {
    const bad = items.find((i) => i.trim().split(/\s+/).length > 3);
    return bad ? `«${bad}»` : null;
  },
};

export function runChecks(testCase, response) {
  const results = [];
  const add = (name, error) => results.push({ name, error });

  if (response.status !== 200) {
    add('ответ 200', `HTTP ${response.status}: ${response.body?.error}`);
    return results;
  }
  const items = response.body.ingredients || [];
  const expect = testCase.expect || {};

  if (expect.empty) {
    add('нет продуктов → пустой список', items.length ? `пришло: ${items.join(', ')}` : null);
    return results;
  }

  for (const [name, check] of Object.entries(general)) add(name, check(items));

  if (expect.must) {
    const missed = expect.must.filter((stems) => !items.some((i) => matches(i, stems)));
    if (expect.must.length) add('все названные продукты найдены', missed.length ? `нет: ${missed.map((s) => s[0]).join(', ')} (пришло: ${items.join(', ')})` : null);

    const allowed = [...expect.must.flat(), ...(expect.optional || [])];
    const extra = items.filter((i) => !matches(i, allowed));
    add('ничего не выдумано', extra.length ? `лишнее: ${extra.join(', ')}` : null);
  }

  if (expect.forbid) {
    const bad = items.filter((i) => matches(i, expect.forbid));
    add('несъедобное и марки не попали', bad.length ? `«${bad.join(', ')}»` : null);
  }

  return results;
}
