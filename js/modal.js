// Примитив модального окна + пикер иконок + стилизованное окно
// подтверждения (замена нативному confirm()).
import { ICON_CHOICES } from './state.js';
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';

let lastFocusedEl = null;

// Стек, а не одна модалка — confirmDialog/alertDialog, вызванные ИЗ уже
// открытой модалки (например, "Удалить" внутри редактирования операции),
// кладутся поверх неё, а не заменяют её. closeModal() снимает только верх
// стека, так что "Отмена" в диалоге подтверждения возвращает к модалке
// под ним, а не закрывает всё целиком.
const modalStack = [];

function topOverlay() {
  return modalStack[modalStack.length - 1] || null;
}

function trapFocus(e) {
  const overlay = topOverlay();
  if (!overlay) return;
  const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function onModalKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  } else if (e.key === 'Tab') {
    trapFocus(e);
  }
}

export function openModal(innerHtml) {
  if (!modalStack.length) {
    lastFocusedEl = document.activeElement;
    document.addEventListener('keydown', onModalKeydown);
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('modal-root').appendChild(overlay);
  modalStack.push(overlay);

  const firstField = overlay.querySelector('input, select, textarea, button');
  if (firstField) firstField.focus();

  return overlay;
}

// Снимает только САМУЮ ВЕРХНЮЮ модалку. Если под ней есть ещё одна —
// она остаётся открытой (и получает фокус обратно).
export function closeModal() {
  const overlay = modalStack.pop();
  if (overlay) overlay.remove();

  if (!modalStack.length) {
    document.removeEventListener('keydown', onModalKeydown);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
    lastFocusedEl = null;
  } else {
    const prevField = topOverlay().querySelector('input, select, textarea, button');
    if (prevField) prevField.focus();
  }
}

// Возвращает Promise<boolean> — true, если пользователь подтвердил.
// Заменяет нативный confirm(), выглядит как остальные модалки приложения.
export function confirmDialog(message, { danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <h3>${t('confirm_title')}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirm-cancel">${t('btn_cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : ''}" id="confirm-ok">${t('btn_delete')}</button>
      </div>
    `);
    // settle() разрешает промис (один раз), closeModal() отдельно и только
    // там, где модалку ещё НЕ закрыли сами (клик по кнопке) — иначе при
    // закрытии кликом по фону/Escape (оверлей уже удалён) мы бы по ошибке
    // сняли ещё и модалку ПОД этой, если confirmDialog вызван из другой модалки.
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => { settle(false); closeModal(); });
    overlay.querySelector('#confirm-ok').addEventListener('click', () => { settle(true); closeModal(); });
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        observer.disconnect();
        settle(false);
      }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
  });
}

// Возвращает Promise<void> — разрешается, когда пользователь закрыл окно.
// Заменяет нативный alert(), который не подхватывает тему и ломает RTL.
export function alertDialog(message) {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <p>${message}</p>
      <div class="modal-actions">
        <span></span>
        <button class="btn" id="alert-ok">${t('btn_ok')}</button>
      </div>
    `);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    overlay.querySelector('#alert-ok').addEventListener('click', () => { settle(); closeModal(); });
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        observer.disconnect();
        settle();
      }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
  });
}

// Группа кнопок-переключателей, где активна только одна ("Расход/Доход" и
// т.п.) — был скопирован вручную в 3 местах (операция, новая категория,
// режим импорта), теперь один переиспользуемый рендер + одна функция wiring.
export function renderToggleGroup(groupId, options, activeValue) {
  return `<div class="type-toggle" id="${groupId}">${options
    .map((o) => `<button type="button" data-value="${escapeHtml(o.value)}" class="${o.value === activeValue ? 'active' : ''}">${escapeHtml(o.label)}</button>`)
    .join('')}</div>`;
}

// onChange(value) вызывается при клике на любую кнопку группы (value — то,
// что было в options[].value). Активный класс переключается автоматически.
export function wireToggleGroup(groupId, onChange) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      onChange(btn.dataset.value);
    });
  });
}

export function renderIconPicker(pickerId, selected) {
  return `<div class="icon-picker" id="${pickerId}">${ICON_CHOICES.map((ic) => `<button type="button" data-icon="${ic}" class="${ic === selected ? 'active' : ''}">${ic}</button>`).join('')}</div>`;
}

// Возвращает функцию-геттер текущей выбранной иконки.
export function wireIconPicker(pickerId, initial) {
  let current = initial || null;
  const picker = document.getElementById(pickerId);
  picker.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = btn.dataset.icon === current ? null : btn.dataset.icon;
      picker.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.icon === current));
    });
  });
  return () => current;
}
