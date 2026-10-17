// Кэшируем только "оболочку" приложения (HTML/CSS/JS), чтобы оно
// быстро открывалось и не падало без сети. Данные из Supabase
// всегда идут напрямую по сети — офлайн-работу с данными не делаем.
const CACHE_NAME = 'urvan-finance-shell-v8';
const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/i18n.js',
  './js/supabaseClient.js',
  './js/api.js',
  './js/state.js',
  './js/utils.js',
  './js/modal.js',
  './js/charts.js',
  './js/tabs.js',
  './js/theme.js',
  './js/app.js',
  './js/render/overview.js',
  './js/render/member.js',
  './js/render/settings.js',
  './js/render/transactions.js',
  './js/render/modalForms.js',
  './js/render/import.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Запросы к Supabase не трогаем — они всегда должны идти в сеть.
  if (url.origin !== self.location.origin) return;

  // Сначала сеть, кэш — только как офлайн-резерв. Раньше было наоборот
  // (отдать кэш сразу, обновить его в фоне) — при обновлении файлы оболочки
  // обновлялись по отдельности, и пользователь мог на короткое время
  // получить смесь старого index.html с новым app.js (или наоборот) —
  // отсюда "сломанная после деплоя" шапка. Раз для данных всё равно нужна
  // сеть (Supabase), нет смысла намеренно отдавать устаревшую оболочку,
  // когда сеть есть.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
