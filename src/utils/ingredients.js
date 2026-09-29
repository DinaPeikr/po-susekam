export const MAX_INGREDIENTS = 30;

// Дописывает продукты к списку: нижний регистр, без дублей (регистр не важен), не больше 30
export function mergeIngredients(list, additions) {
  const result = [...list];
  for (const raw of additions) {
    const item = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (item && !result.includes(item) && result.length < MAX_INGREDIENTS) result.push(item);
  }
  return result;
}
