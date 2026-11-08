/* Keeps every game on the device after its first download.
   Each later visit asks the server one small question ("changed since this copy?"):
   no → the saved copy opens at once; yes → the new version streams in and replaces it; no internet → the saved copy. */
const CACHE = 'tirat-games-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (!/\/versions\/.+\.html?$/i.test(url.pathname)) return;     // only the games; everything else goes to the network as usual
  e.respondWith(serveGame(url.origin + url.pathname));
});

async function serveGame(href) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(href);
  if (saved) {
    const tag = saved.headers.get('etag'), since = saved.headers.get('last-modified');
    const ask = {};
    if (tag) ask['If-None-Match'] = tag; else if (since) ask['If-Modified-Since'] = since;
    try {
      const fresh = await fetch(href, { headers: ask, cache: 'no-store' });
      if (fresh.status === 304) return saved;                         // unchanged: open the copy on the device
      if (fresh.ok) { cache.put(href, fresh.clone()).catch(() => {}); return fresh; }   // a new version: play it, and keep it
      return saved;
    } catch (err) {
      return saved;                                                  // no internet: the copy we have
    }
  }
  const res = await fetch(href, { cache: 'no-store' });
  if (res.ok) cache.put(href, res.clone()).catch(() => {});           // first time: keep it while it streams to the page
  return res;
}
