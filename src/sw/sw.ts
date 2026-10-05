// niben.no service worker – fast start + automatic updates.
//  - the page itself, data.json and api.php: network first (always fresh when online)
//  - hashed build files and fonts: cache first (they never change under the same name)
//  - 3D models and images: shown from the cache at once, refreshed in the background
// Built to /sw.js by the serviceWorker plugin in vite.config.ts (a worker file, so it has its own tsconfig.sw.json).
const sw = self as unknown as ServiceWorkerGlobalScope

const CACHE = 'niben-v3'

sw.addEventListener('install', () => sw.skipWaiting())
sw.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await sw.clients.claim()
  })())
})

const isHashed = (p: string) => /-[\w-]{6,}\.js$/.test(p)
const isStatic = (p: string) => /\.(glb|png|jpg|jpeg|webp|svg|woff2?)$/.test(p)

async function networkFirst(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    const hit = await cache.match(req)
    if (hit) return hit
    throw new Error('offline')
  }
}
// files with a fixed name (meg.jpg, the guitar models): show the saved copy at once, refresh it in the background
async function staleWhileRevalidate(req: Request, e: ExtendableEvent): Promise<Response> {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req)
  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone())
    return res
  }).catch(() => hit ?? Response.error())
  if (hit) {
    e.waitUntil(fresh)
    return hit
  }
  return fresh
}
async function cacheFirst(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  // opaque (no-CORS) responses count as several MB each against the storage quota – skip those
  if (res.ok && res.type !== 'opaque') cache.put(req, res.clone())
  return res
}

sw.addEventListener('fetch', (e: FetchEvent) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === sw.location.origin) {
    if (url.pathname.endsWith('.php') || url.pathname.startsWith('/uploads/')) return // live data, never cached here
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('data.json') || url.pathname.endsWith('manifest.json')) {
      e.respondWith(networkFirst(req))
    } else if (isHashed(url.pathname)) {
      e.respondWith(cacheFirst(req))
    } else if (isStatic(url.pathname)) {
      e.respondWith(staleWhileRevalidate(req, e))
    }
    return
  }
  // web fonts, album art and book covers never change for the same address – keep them
  if (/^(fonts\.(googleapis|gstatic)\.com|i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com|covers\.openlibrary\.org)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req))
  }
})
