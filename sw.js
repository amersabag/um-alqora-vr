// Service worker: precache the whole build on install so the film plays with the network
// unplugged. The file list and cache version are written in at build time
// (scripts/vite-sw-manifest.js). Requests are answered cache-first.
const CACHE = 'uqu-film-df39634d3dbe';
const PRECACHE = ["./","assets/audio/music.m4a","assets/clips/greening-hi.mp4","assets/clips/greening-lo.mp4","assets/clips/greening-poster.jpg","assets/clips/workshop-a-hi.mp4","assets/clips/workshop-a-lo.mp4","assets/clips/workshop-a-poster.jpg","assets/clips/workshop-b-hi.mp4","assets/clips/workshop-b-lo.mp4","assets/clips/workshop-b-poster.jpg","assets/fonts/GE-SS-Text-Medium.otf","assets/fonts/GE-SS-Two-Bold.otf","assets/fonts/GE_SS_Two_Light.otf","assets/fonts/NotoSans-Bold.ttf","assets/index-DPc57uv0.js","assets/logo/icon-192.png","assets/logo/logo-colour-1024.png","assets/logo/logo-colour-2048.png","assets/logo/logo-colour.svg","assets/logo/logo-white-1024.png","assets/logo/logo-white-2048.png","assets/logo/logo-white-on-teal.svg","assets/tex/lattice-256.png","assets/tex/lattice.png","index.html"];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache, so a redeploy never mixes old and new files
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// The page asks whether the whole film is cached, to show "ready offline".
self.addEventListener('message', (e) => {
  if (e.data !== 'offline-status') return;
  e.waitUntil(caches.open(CACHE).then((c) => c.keys()).then((keys) => {
    e.source?.postMessage({ type: 'offline-status', ready: keys.length >= PRECACHE.length });
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('uqu-film-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    // ignore the query string (?tier=low etc.) when matching the page
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return e.request.headers.has('range') ? partial(hit, e.request.headers.get('range')) : hit;
    const res = await fetch(e.request);
    if (res.ok && res.type === 'basic') c.put(e.request, res.clone());
    return res;
  }));
});

// Media elements fetch with Range headers and can only seek in a 206 response, so slice
// the cached body (the music is seeked on resume and reset).
async function partial(res, range) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? +m[1] : 0;
  let end = m && m[2] ? +m[2] : buf.byteLength - 1;
  if (m && !m[1] && m[2]) { start = buf.byteLength - +m[2]; end = buf.byteLength - 1; }
  end = Math.min(end, buf.byteLength - 1);
  if (start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${buf.byteLength}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/octet-stream',
      'content-range': `bytes ${start}-${end}/${buf.byteLength}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    },
  });
}
