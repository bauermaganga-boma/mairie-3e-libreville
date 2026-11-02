/* Mairie du 3e arrondissement de Libreville — service worker : le site s'ouvre même avec une connexion faible */
const C = "l3e-v1";
const CORE = ["./","index.html","demarches.html","payer.html","arrondissement.html","arrondissements.html","mairie.html","projets.html","transparence.html","actualites.html","contact.html","espace.html","assets/css/style.css","assets/js/data.js","assets/js/config.js","assets/js/store.js","assets/js/main.js","assets/img/logo-3e.svg","assets/img/front-de-mer.jpg"];
// Mise en cache tolérante : une page ou une image absente n'empêche pas l'installation
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
// Réseau d'abord (contenus toujours à jour), cache en secours hors connexion
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match("index.html"))));
});
