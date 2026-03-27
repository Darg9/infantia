// =============================================================================
// Infantia Service Worker — Web Push notifications
// =============================================================================

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Handle incoming push events
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Infantia'
  const options = {
    body: data.body ?? 'Nueva actividad disponible',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag ?? 'infantia-default',
    data: { url: data.url ?? '/actividades' },
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click — open the URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/actividades'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a tab is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      })
  )
})
