// Размер задаём параметрами ссылки: и Unsplash, и Pexels режут картинку на своей стороне
export function photoUrl(photo, width, height) {
  if (!photo?.raw) return '';
  const url = new URL(photo.raw);
  url.searchParams.set('w', width);
  url.searchParams.set('h', height);
  url.searchParams.set('fit', 'crop');
  if (photo.id.startsWith('pexels-')) {
    url.searchParams.set('auto', 'compress');
    url.searchParams.set('cs', 'tinysrgb');
  } else {
    url.searchParams.set('q', '75');
  }
  return url.toString();
}
