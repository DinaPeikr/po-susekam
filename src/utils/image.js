const MAX_SIDE = 1568; // больше Claude всё равно уменьшит — лишние байты и токены

// Фото с телефона весит 3–10 МБ: уменьшаем в браузере и перекодируем в JPEG
export async function prepareImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC и прочее, что браузер не умеет открыть
    throw new Error('Не получилось открыть фото. Попробуйте JPG или PNG');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { image: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl };
}

export async function recognize(payload) {
  const response = await fetch('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не получилось распознать продукты, попробуйте ещё раз');
  return data.ingredients || [];
}
