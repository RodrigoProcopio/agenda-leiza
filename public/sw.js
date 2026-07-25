const CACHE_NAME = "agenda-leiza-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estratégia simples: tenta a rede primeiro (dados sempre atualizados);
// se falhar (offline), cai para o cache do "app shell".
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Não intercepta chamadas para a API do Supabase — precisam ser sempre
  // em tempo real (nunca servidas do cache).
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
