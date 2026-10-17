// Примитив модального окна + пикер иконок + стилизованное окно
// подтверждения (замена нативному confirm()).
import { ICON_CHOICES } from './state.js';
import { t } from './i18n.js';

let lastFocusedEl = null;

function trapFocus(e) {
  const overlay = document.getElementById('modal-overlay');
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
  closeModal();
  lastFocusedEl = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('modal-root').appendChild(overlay);
  document.addEventListener('keydown', onModalKeydown);

  const firstField = overlay.querySelector('input, select, textarea, button');
  if (firstField) firstField.focus();
}

export function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
  document.removeEventListener('keydown', onModalKeydown);
  if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
  lastFocusedEl = null;
}

// Возвращает Promise<boolean> — true, если пользователь подтвердил.
// Заменяет нативный confirm(), выглядит как остальные модалки приложения.
export function confirmDialog(message, { danger = true } = {}) {
  return new Promise((resolve) => {
    openModal(`
      <h3>${t('confirm_title')}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirm-cancel">${t('btn_cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : ''}" id="confirm-ok">${t('btn_delete')}</button>
      </div>
    `);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(result);
    };
    document.getElementById('confirm-cancel').addEventListener('click', () => finish(false));
    document.getElementById('confirm-ok').addEventListener('click', () => finish(true));
    // closeModal() может быть вызван извне (клик по фону, Escape) — в этом
    // случае тоже нужно разрешить промис значением false, а не оставлять его висеть.
    const overlay = document.getElementById('modal-overlay');
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        observer.disconnect();
        finish(false);
      }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
  });
}

// Возвращает Promise<void> — разрешается, когда пользователь закрыл окно.
// Заменяет нативный alert(), который не подхватывает тему и ломает RTL.
export function alertDialog(message) {
  return new Promise((resolve) => {
    openModal(`
      <p>${message}</p>
      <div class="modal-actions">
        <span></span>
        <button class="btn" id="alert-ok">${t('btn_ok')}</button>
      </div>
    `);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve();
    };
    document.getElementById('alert-ok').addEventListener('click', finish);
    const overlay = document.getElementById('modal-overlay');
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        observer.disconnect();
        finish();
      }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
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
