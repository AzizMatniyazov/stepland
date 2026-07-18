const CACHE_NAME = 'stepland-v4'

// On install - skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting()
})

// On activate - delete ALL old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

// Network first for EVERYTHING
// Only fall back to cache if completely offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip Supabase API calls entirely - never cache these
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Got a fresh response - cache it for offline use
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed - try cache as fallback
        return caches.match(event.request)
      })
  )
})