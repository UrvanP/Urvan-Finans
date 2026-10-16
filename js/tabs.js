// Переключение вкладок, плавающая кнопка добавления и общий "обновить всё
// после изменения" (refreshApp). Это единственное место, которое знает про
// ВСЕ вкладки сразу — остальные модули дёргают refreshApp()/renderCurrentTab(),
// не заботясь о том, кто сейчас активен.
import { state, loadAll, avatarColor, cashAccount, currentAccountOf, displayMemberName } from './state.js';
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';
import { icon } from './icons.js';
import { openModal, closeModal } from './modal.js';
import { renderOverview, attachOverviewEvents } from './render/overview.js';
import { renderMemberTab, attachMemberEvents, memberSubTab } from './render/member.js';
import { renderSettingsTab, attachSettingsEvents } from './render/settings.js';
import { openTransactionModal, openCheckpointModal } from './render/modalForms.js';

export let currentTab = 'overview';

export function switchToTab(tabKey) {
  currentTab = tabKey;
  renderTabs();
  renderCurrentTab();
}

// Показывается один раз, пока идёт самая первая загрузка данных — вместо
// пустого экрана. На повторные refreshApp() (после сохранения чего-либо)
// не вызывается: там на экране уже есть актуальный контент.
export function renderAppSkeleton() {
  document.getElementById('app').innerHTML = `
    <div class="card gauge-card"><div class="skeleton skeleton-circle"></div></div>
    <div class="summary-grid">
      <div class="card skeleton-card"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line" style="width:40%;height:22px;"></div></div>
      <div class="card skeleton-card"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line" style="width:40%;height:22px;"></div></div>
      <div class="card skeleton-card"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line" style="width:40%;height:22px;"></div></div>
    </div>
    <div class="card chart-card"><div class="skeleton" style="height:200px;"></div></div>
  `;
}

export function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  nav.appendChild(makeTabButton('overview', t('tab_overview'), `<span class="tab-icon">${icon('home')}</span>`));
  state.members.forEach((m) => {
    const displayName = displayMemberName(m.name);
    const avatar = `<span class="tab-avatar" style="background:${avatarColor(m.name)}">${escapeHtml(displayName.charAt(0).toUpperCase())}</span>`;
    nav.appendChild(makeTabButton('member:' + m.id, displayName, avatar));
  });
  nav.appendChild(makeTabButton('settings', t('tab_settings'), `<span class="tab-icon">${icon('settings')}</span>`));
}

function makeTabButton(tabKey, label, iconHtml) {
  const btn = document.createElement('button');
  btn.className = 'tab-btn' + (tabKey === currentTab ? ' active' : '');
  btn.innerHTML = `${iconHtml}<span class="tab-label">${escapeHtml(label)}</span>`;
  btn.addEventListener('click', () => switchToTab(tabKey));
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
  updateHeaderIdentity();
}

// ---------------------------------------------------------------
// Переключатель профиля в шапке — показывает, чей сейчас вид открыт
// (конкретный член семьи или "Портфолио" — вид на всю семью сразу),
// клик открывает список для быстрой смены.
// ---------------------------------------------------------------

function updateHeaderIdentity() {
  const badge = document.getElementById('header-badge');
  const nameEl = document.getElementById('header-identity-name');
  if (!badge || !nameEl) return;

  if (currentTab.startsWith('member:')) {
    const member = state.members.find((m) => m.id === currentTab.slice('member:'.length));
    if (member) {
      const displayName = displayMemberName(member.name);
      badge.textContent = displayName.charAt(0).toUpperCase();
      badge.style.background = avatarColor(member.name);
      nameEl.textContent = displayName;
      return;
    }
  }
  if (currentTab === 'overview') {
    badge.innerHTML = icon('users', { size: 16 });
    badge.style.background = '';
    nameEl.textContent = t('header_portfolio_label');
    return;
  }
  badge.textContent = '₪';
  badge.style.background = '';
  nameEl.textContent = t('app_title');
}

export function openProfileSwitcher() {
  const items = [
    { key: 'overview', label: t('header_portfolio_label'), badgeHtml: icon('users', { size: 16 }), bg: null },
    ...state.members.map((m) => ({
      key: 'member:' + m.id,
      label: displayMemberName(m.name),
      badgeHtml: escapeHtml(displayMemberName(m.name).charAt(0).toUpperCase()),
      bg: avatarColor(m.name),
    })),
  ];

  openModal(`
    <h3>${t('profile_switch_title')}</h3>
    <div class="profile-switch-list">
      ${items.map((it) => `
        <button type="button" class="profile-switch-item ${it.key === currentTab ? 'active' : ''}" data-key="${it.key}">
          <span class="header-badge" style="${it.bg ? `background:${it.bg}` : ''}">${it.badgeHtml}</span>
          <span>${escapeHtml(it.label)}</span>
        </button>`).join('')}
    </div>
  `);

  document.querySelectorAll('.profile-switch-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal();
      switchToTab(btn.dataset.key);
    });
  });
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
