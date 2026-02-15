// Service Worker for Share Target handling only
self.addEventListener('fetch', (event) => {
  // Handle share target POST requests
  if (event.request.method === 'POST') {
    event.respondWith(Response.redirect('./'));
    return;
  }
  
  // Let other requests pass through normally
  event.respondWith(fetch(event.request));
});