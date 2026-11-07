// Cornerstone service worker: lets the app install, open offline, and keep cached covers.
// Same-origin files are fetched network-first, so a fresh deploy always wins when you're online;
// the cache only steps in when the network is slow or gone. Cached cover thumbnails are served instantly.
const CACHE = 'cornerstone-v1';
const SHELL = ['./', 'index.html', 'core.js', 'studio.js', 'studio.css', 'puzzle.js', 'puzzle.css', 'beta-ui.js', 'beta-config.js', 'top-songs.js', 'catalog.json', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'assets/tres-phone.jpg', 'assets/tres-desktop.jpg'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not block installation.
    await Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(6000) });
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true }) || (request.mode === 'navigate' ? await cache.match('index.html') : null);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // MusicBrainz, Cover Art Archive, Spotify: never intercepted
  event.respondWith(url.pathname.includes('/covers/') ? cacheFirst(request) : networkFirst(request));
});
