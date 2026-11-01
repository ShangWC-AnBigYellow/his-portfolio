/* Portfolio service worker.
   Cache name and precache list are injected by scripts/build.py, so the list always
   matches the files actually shipped in dist/. No online tile is ever cached: the
   offline map uses the bundled Natural Earth vectors instead (see BASEMAP_SOURCE.json). */
'use strict';
const CACHE = 'portfolio-862f742d64';
const PRECACHE = [".nojekyll", "BUILD_INFO.json", "app.js", "assets/course-interface.webp", "assets/course-map-upgrade.webp", "assets/dcz-thumb.webp", "assets/dcz.webp", "assets/favicon.svg", "assets/hsc-before.webp", "assets/hsc-thumb.webp", "assets/hsc.webp", "assets/p1-thumb.webp", "assets/p1.webp", "assets/p2-thumb.webp", "assets/p2.webp", "assets/p3-thumb.webp", "assets/p3.webp", "assets/p4-thumb.webp", "assets/p4.webp", "assets/print/course-interface-print.jpg", "assets/print/course-map-upgrade-print.jpg", "assets/print/dcz-print.jpg", "assets/print/hsc-before-print.jpg", "assets/print/hsc-print.jpg", "assets/print/p1-print.jpg", "assets/print/p1-thumb-print.jpg", "assets/print/p2-print.jpg", "assets/print/p3-print.jpg", "assets/print/p4-print.jpg", "assets/print/sck-print.jpg", "assets/print/stats-print.jpg", "assets/print/vault-print.jpg", "assets/sck-before.webp", "assets/sck-thumb.webp", "assets/sck.webp", "assets/shots/agents.jpg", "assets/shots/benchmark.jpg", "assets/shots/home.jpg", "assets/shots/maps.jpg", "assets/shots/method.jpg", "assets/shots/sources.jpg", "assets/shots/stats.jpg", "assets/shots/vault.jpg", "data.js", "demo-map/basemap/BASEMAP_SOURCE.json", "demo-map/basemap/basemap-data.js", "demo-map/course.bundle.js", "demo-map/course.css", "demo-map/index.html", "demo-map/map-config.js", "demo-map/map-controller.js", "demo-map/offline.css", "demo-map/upgrade-ui.js", "demo-map/upgrade.css", "demo/course.css", "demo/course.js", "demo/index.html", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/make.html", "index.html", "manifest.webmanifest", "print/index.html", "print/print.css", "pwa.js", "style.css", "touch.css"];
const OFFLINE_URL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll() would reject on a single 404; keep whatever succeeds instead.
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (e) { /* reported at runtime */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('portfolio-')).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isTile(url) {
  return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Online basemap tiles: straight to the network, never stored (OSM tile policy).
  if (isTile(url)) return;

  if (url.origin !== self.location.origin) return; // let the browser handle it

  // Page navigations: network first so a fresh deploy is picked up, cache as fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetchWithTimeout(req, 4000);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        }
        throw new Error('bad response');
      } catch (e) {
        const cache = await caches.open(CACHE);
        // ignoreSearch: a URL with ?query still resolves to its precached page.
        return (await cache.match(req, { ignoreSearch: true })) ||
          (await cache.match(OFFLINE_URL)) ||
          new Response('<h1>离线</h1><p>该页面尚未缓存，请联网后重新打开一次。</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 });
      }
    })());
    return;
  }

  // Static assets: cache first, then network; store what we fetch.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(timer); resolve(r); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
