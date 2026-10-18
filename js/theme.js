// Приватность (скрыть суммы), тема (светлая/тёмная/как в системе) и язык.
import { t, LANGUAGES, getLang, setLang } from './i18n.js';
import { openModal, closeModal } from './modal.js';
import { renderTabs, renderCurrentTab } from './tabs.js';
import { icon } from './icons.js';

let privacyMode = false;

function applyPrivacyButton() {
  const btn = document.getElementById('btn-privacy');
  if (!btn) return;
  btn.innerHTML = icon(privacyMode ? 'eye-off' : 'eye');
  btn.title = privacyMode ? t('privacy_show_title') : t('privacy_hide_title');
}

export function togglePrivacy() {
  privacyMode = !privacyMode;
  document.body.classList.toggle('privacy-mode', privacyMode);
  applyPrivacyButton();
}

export function getTheme() {
  return localStorage.getItem('theme') || 'system';
}

export function setTheme(mode) {
  localStorage.setItem('theme', mode);
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

function applyThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const mode = getTheme();
  btn.innerHTML = icon(mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'monitor');
  const modeLabel = mode === 'dark' ? t('theme_dark') : mode === 'light' ? t('theme_light') : t('theme_system');
  btn.title = `${t('theme_btn_title')}: ${modeLabel}`;
}

// Простой 2-позиционный переключатель светлая/тёмная — раньше цикл шёл
// system → light → dark → system, и если системная тема тоже тёмная,
// клик с "Тёмная" переводил на "Как в системе" без видимой смены цвета:
// пользователь видел "ночь" дважды подряд, прежде чем дойти до светлой.
// Переключаем от ТЕКУЩЕЙ ОТОБРАЖАЕМОЙ темы, а не от сохранённого режима —
// так переключение всегда меняет цвет с первого клика.
export function cycleTheme() {
  const isDarkNow = getTheme() === 'dark'
    || (getTheme() === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  setTheme(isDarkNow ? 'light' : 'dark');
  applyThemeButton();
  renderCurrentTab();
}

export function applyStaticText() {
  document.title = t('app_title');
  // Элементы ищем защищённо: сразу после деплоя у части пользователей может
  // на короткое время оказаться старый закэшированный index.html рядом с
  // новым app.js (service worker обновляет файлы по отдельности) — без этой
  // проверки отсутствующая кнопка валила бы всю функцию с TypeError, и
  // остальные (тема/приватность) оставались бы без иконок.
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.title = t('lang_btn_title');
    langBtn.innerHTML = icon('globe');
  }
  const searchBtn = document.getElementById('btn-search');
  if (searchBtn) {
    searchBtn.title = t('search_btn_title');
    searchBtn.innerHTML = icon('search');
  }
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.title = t('tab_settings');
    settingsBtn.innerHTML = icon('settings');
  }
  applyPrivacyButton();
  applyThemeButton();
}

export function openLanguageModal() {
  const current = getLang();
  const optionsHtml = LANGUAGES.map((l) => `
    <button type="button" class="lang-option ${l.code === current ? 'active' : ''}" data-code="${l.code}">${l.label}</button>
  `).join('');

  openModal(`
    <h3>${t('lang_picker_title')}</h3>
    <div class="lang-option-list">${optionsHtml}</div>
  `);

  document.querySelectorAll('.lang-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.code);
      closeModal();
      applyStaticText();
      renderTabs();
      renderCurrentTab();
    });
  });
}
