// Догружает фото карточкам. Фото берём первое, чей id не занят другой карточкой:
// у похожих блюд Unsplash часто отдаёт один и тот же снимок
export function loadPhotos(recipes) {
  const pending = recipes.filter((recipe) => !recipe.photo && recipe.photoStatus !== 'loading' && recipe.image_query);
  return Promise.all(pending.map(async (recipe) => {
    recipe.photoStatus = 'loading';
    try {
      const response = await fetch(`/api/photo?q=${encodeURIComponent(recipe.image_query)}`);
      if (!response.ok) throw new Error(`photo ${response.status}`);
      const { photos = [] } = await response.json();
      const taken = new Set(recipes.filter((other) => other !== recipe && other.photo).map((other) => other.photo.id));
      recipe.photo = photos.find((photo) => !taken.has(photo.id)) || null;
      recipe.photoStatus = 'done';
    } catch {
      // Остаётся idle — догрузится при следующем заходе
      recipe.photoStatus = 'idle';
    }
  }));
}
