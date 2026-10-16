// Небольшие независимые утилиты без состояния и без зависимостей от
// остального приложения — можно использовать где угодно.

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[s]));
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪';
}

export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Анимированный счётчик для "героического" числа (гейдж на Общем статусе) —
// считает от 0 до targetValue вместо того, чтобы число просто появлялось
// готовым. Уважает prefers-reduced-motion и не анимирует, если элемент уже
// скрыт (например, вкладку успели переключить).
export function animateCountUp(el, targetValue, formatFn, duration = 700) {
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = formatFn(targetValue);
    return;
  }
  const start = performance.now();
  function frame(now) {
    if (!document.body.contains(el)) return;
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatFn(targetValue * eased);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Блокирует кнопку и подменяет текст на время выполнения async-операции —
// защищает от повторной отправки формы при двойном клике. При ошибке кнопка
// возвращается в исходное состояние (при успехе UI обычно сам перерисуется).
export async function withBusy(btn, busyLabel, fn) {
  const originalText = btn.textContent;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    return await fn();
  } catch (err) {
    btn.disabled = originalDisabled;
    btn.textContent = originalText;
    throw err;
  }
}
