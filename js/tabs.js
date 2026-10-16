// Переключение вкладок, плавающая кнопка добавления и общий "обновить всё
// после изменения" (refreshApp). Это единственное место, которое знает про
// ВСЕ вкладки сразу — остальные модули дёргают refreshApp()/renderCurrentTab(),
// не заботясь о том, кто сейчас активен.
import { state, loadAll, avatarColor, cashAccount, currentAccountOf } from './state.js';
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';
import { renderOverview, attachOverviewEvents } from './render/overview.js';
import { renderMemberTab, attachMemberEvents, memberSubTab } from './render/member.js';
import { renderSettingsTab, attachSettingsEvents } from './render/settings.js';
import { openTransactionModal, openCheckpointModal } from './render/modalForms.js';

export let currentTab = 'overview';

export function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  nav.appendChild(makeTabButton('overview', t('tab_overview'), '<span class="tab-icon">🏠</span>'));
  state.members.forEach((m) => {
    const avatar = `<span class="tab-avatar" style="background:${avatarColor(m.name)}">${escapeHtml(m.name.charAt(0).toUpperCase())}</span>`;
    nav.appendChild(makeTabButton('member:' + m.id, m.name, avatar));
  });
  nav.appendChild(makeTabButton('settings', t('tab_settings'), '<span class="tab-icon">⚙️</span>'));
}

function makeTabButton(tabKey, label, iconHtml) {
  const btn = document.createElement('button');
  btn.className = 'tab-btn' + (tabKey === currentTab ? ' active' : '');
  btn.innerHTML = `${iconHtml}<span class="tab-label">${escapeHtml(label)}</span>`;
  btn.addEventListener('click', () => {
    currentTab = tabKey;
    renderTabs();
    renderCurrentTab();
  });
  return btn;
}

export function renderCurrentTab() {
  const app = document.getElementById('app');
  if (currentTab === 'overview') {
    app.innerHTML = renderOverview();
    attachOverviewEvents();
  } else if (currentTab === 'settings') {
    app.innerHTML = renderSettingsTab();
    attachSettingsEvents();
  } else if (currentTab.startsWith('member:')) {
    const memberId = currentTab.slice('member:'.length);
    app.innerHTML = renderMemberTab(memberId);
    attachMemberEvents(memberId);
  }
  updateFab();
}

// Перезагружает данные с сервера и перерисовывает текущую вкладку.
// Вызывается после любого изменения (добавить/удалить/сохранить что угодно).
export async function refreshApp() {
  const ok = await loadAll();
  if (!ok) return;
  renderTabs();
  renderCurrentTab();
}

// ---------------------------------------------------------------
// Плавающая кнопка добавления — контекстно зависит от вкладки
// ---------------------------------------------------------------

function updateFab() {
  const fab = document.getElementById('fab');
  if (!fab) return;

  if (currentTab === 'overview') {
    const cash = cashAccount();
    fab.style.display = cash ? 'flex' : 'none';
    fab.onclick = () => { if (cash) openTransactionModal({ accountId: cash.id }); };
  } else if (currentTab.startsWith('member:')) {
    const memberId = currentTab.slice('member:'.length);
    const selected = memberSubTab[memberId] || 'current';
    fab.style.display = 'flex';
    if (selected === 'current') {
      const account = currentAccountOf(memberId);
      fab.onclick = () => { if (account) openTransactionModal({ accountId: account.id }); };
    } else {
      fab.onclick = () => openCheckpointModal({ accountId: selected });
    }
  } else {
    fab.style.display = 'none';
    fab.onclick = null;
  }
}
