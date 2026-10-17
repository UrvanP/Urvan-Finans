// Небольшой набор инлайновых SVG-иконок для интерфейса (навигация, кнопки
// действий) — вместо эмодзи, которые на разных платформах выглядят по-разному
// и не меняют цвет вместе с текстом. Каждая иконка — чистый stroke-path на
// сетке 24×24, цвет наследуется через currentColor, поэтому она подхватывает
// цвет окружающего текста/кнопки без дополнительных стилей.
//
// Эмодзи-пикер для категорий/копилок (ICON_CHOICES в state.js) сюда
// сознательно не входит: это выбираемый пользователем контент, уже хранится
// как эмодзи в базе — перевод на другой формат потребовал бы миграции данных.

const PATHS = {
  home: '<path d="M3 11L12 4l9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><rect x="10.3" y="2.3" width="3.4" height="3.4" rx="0.8"/><rect x="10.3" y="18.3" width="3.4" height="3.4" rx="0.8"/><rect x="2.3" y="10.3" width="3.4" height="3.4" rx="0.8"/><rect x="18.3" y="10.3" width="3.4" height="3.4" rx="0.8"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M10.6 10.6a3 3 0 0 0 4.24 4.24"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a13.2 13.2 0 0 1-3.17 3.88M6.1 6.1A13.2 13.2 0 0 0 1 11s1.6 2.8 4.5 4.8"/><path d="M3 3l18 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  users: '<circle cx="8" cy="9" r="4"/><circle cx="16" cy="10" r="3.2"/><path d="M2 20.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2"/><path d="M14.3 14.6c2.8.5 4.7 2.7 4.7 5.9"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};

export function icon(name, { size = 20, strokeWidth = 2, className = '' } = {}) {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
