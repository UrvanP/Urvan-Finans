// Создаём один общий клиент для общения с Supabase.
// window.supabase здесь — это глобальный объект из библиотеки supabase-js,
// подключённой в index.html через <script> с CDN (она не ES-модуль).
// Если ключи ещё не вписаны в config.js, createClient может упасть —
// оборачиваем в try/catch, чтобы страница не превращалась в белый экран,
// а app.js мог показать понятную подсказку пользователю.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export let db = null;
try {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Не удалось создать клиент Supabase:', e);
}
