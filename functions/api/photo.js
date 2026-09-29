import { json } from '../../lib/claude.js';

const UTM = 'utm_source=po_susekam&utm_medium=referral';
const withUtm = (url) => `${url}${url.includes('?') ? '&' : '?'}${UTM}`;

async function fromUnsplash(query, key) {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.search = new URLSearchParams({ query: `${query} food`, per_page: '5', orientation: 'landscape', content_filter: 'high' });
  const response = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
  if (!response.ok) throw new Error(`Unsplash ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((photo) => ({
    id: `unsplash-${photo.id}`,
    raw: photo.urls.raw,
    alt: photo.alt_description || '',
    author: photo.user.name,
    authorUrl: withUtm(photo.user.links.html),
    sourceName: 'Unsplash',
    sourceUrl: withUtm('https://unsplash.com/'),
  }));
}

async function fromPexels(query, key) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.search = new URLSearchParams({ query: `${query} food`, per_page: '5', orientation: 'landscape' });
  const response = await fetch(url, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels ${response.status}`);
  const data = await response.json();
  return (data.photos || []).map((photo) => ({
    id: `pexels-${photo.id}`,
    raw: photo.src.original,
    alt: photo.alt || '',
    author: photo.photographer,
    authorUrl: photo.photographer_url,
    sourceName: 'Pexels',
    sourceUrl: photo.url,
  }));
}

export async function onRequestGet({ request, env, waitUntil }) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 80);
  if (!query) return json({ error: 'Нужен параметр q' }, 400);

  const cache = caches.default;
  const cacheKey = new Request(`https://photo-cache.local/?q=${encodeURIComponent(query.toLowerCase())}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const sources = [];
  if (env.UNSPLASH_ACCESS_KEY) sources.push(() => fromUnsplash(query, env.UNSPLASH_ACCESS_KEY));
  if (env.PEXELS_API_KEY) sources.push(() => fromPexels(query, env.PEXELS_API_KEY));
  if (!sources.length) return json({ photos: [] });

  // Unsplash Demo — 50 запросов в час; кончился или пусто — идём в Pexels
  let failures = 0;
  for (const source of sources) {
    try {
      const photos = await source();
      if (!photos.length) continue;
      const response = json({ photos }, 200, { 'Cache-Control': 'public, max-age=86400' });
      waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      failures += 1;
      console.error('photo source failed', error.message);
    }
  }
  // Оба отказали — не кэшируем, чтобы через час фото появились
  if (failures === sources.length) return json({ error: 'Фото временно недоступны' }, 503);
  return json({ photos: [] });
}
