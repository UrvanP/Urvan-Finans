// Точка входа: один раз настраивает язык/тему, вешает обработчики на кнопки
// шапки и запускает первую загрузку данных. Вся остальная логика живёт
// в отдельных модулях (state.js, tabs.js, charts.js, modal.js, theme.js,
// render/*.js) — здесь только провода между ними.
import { getLang, setLang } from './i18n.js';
import { getTheme, setTheme, applyStaticText, togglePrivacy, cycleTheme, openLanguageModal } from './theme.js';
import { refreshApp, renderAppSkeleton, openProfileSwitcher, switchToTab } from './tabs.js';
import { openGlobalSearchModal } from './render/search.js';

setLang(getLang());
setTheme(getTheme());
applyStaticText();
document.getElementById('header-identity').addEventListener('click', openProfileSwitcher);
document.getElementById('btn-search').addEventListener('click', openGlobalSearchModal);
document.getElementById('btn-settings').addEventListener('click', () => switchToTab('settings'));
document.getElementById('btn-privacy').addEventListener('click', togglePrivacy);
document.getElementById('btn-theme').addEventListener('click', cycleTheme);
document.getElementById('btn-lang').addEventListener('click', openLanguageModal);
renderAppSkeleton();
refreshApp();

// Регистрируем service worker, чтобы приложение можно было "установить"
// на телефон (иконка на рабочем столе) — это и есть Android-версия.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch((e) => console.error('SW error:', e));
}
