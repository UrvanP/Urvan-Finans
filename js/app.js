// Вся логика интерфейса: переключение вкладок, отрисовка данных,
// модальные окна для добавления/редактирования.
// Данные храним в одном объекте state и перечитываем их из Supabase
// после каждого изменения (просто и надёжно для такого размера приложения).

let state = { members: [], categories: [], accounts: [], transactions: [], checkpoints: [] };
let currentTab = 'overview';
let privacyMode = false;
let memberSubTab = {};
let txFilters = {};
let chartPeriod = 'all';
let chartCustomFrom = '';
let chartCustomTo = '';
let importHeaders = [];
let importParsedRows = null;

const ICON_CHOICES = ['💰', '🏦', '🐷', '💳', '🛒', '🍔', '🚗', '🏠', '💊', '🎓', '🎁', '✈️', '📱', '👗', '🎮', '📈', '👶', '⚡', '🧾', '☕', '🐾', '💼'];

// ---------------------------------------------------------------
// Загрузка данных
// ---------------------------------------------------------------

async function loadAll() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('ВСТАВЬТЕ') || SUPABASE_ANON_KEY.includes('ВСТАВЬТЕ')) {
    showSetupNeeded();
    return;
  }
  try {
    const [members, categories, accounts, transactions, checkpoints] = await Promise.all([
      Api.getMembers(),
      Api.getCategories(),
      Api.getAccounts(),
      Api.getTransactions(),
      Api.getCheckpoints(),
    ]);
    state = { members, categories, accounts, transactions, checkpoints };
    renderTabs();
    renderCurrentTab();
  } catch (err) {
    showLoadError(err);
  }
}

function showSetupNeeded() {
  document.getElementById('app').innerHTML = `<div class="error-banner">${t('setup_needed_html')}</div>`;
}

function showLoadError(err) {
  document.getElementById('app').innerHTML = `
    <div class="error-banner">
      ${t('load_error_html')}
      <small>${escapeHtml(err.message || String(err))}</small>
    </div>`;
}

// ---------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[s]));
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪';
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function accountBalance(account) {
  if (!account) return 0;
  if (account.type === 'savings') {
    const cps = checkpointsSorted(account.id, 'asc');
    if (cps.length === 0) return Number(account.initial_balance) || 0;
    return Number(cps[cps.length - 1].balance);
  }
  const delta = state.transactions
    .filter((t) => t.account_id === account.id)
    .reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  return Number(account.initial_balance) + delta;
}

// Чекапы копилки, отсортированные по дате. order: 'asc' | 'desc'.
function checkpointsSorted(accountId, order) {
  const list = state.checkpoints.filter((c) => c.account_id === accountId).slice();
  list.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  if (order === 'desc') list.reverse();
  return list;
}

function currentAccountOf(memberId) {
  return state.accounts.find((a) => a.member_id === memberId && a.type === 'current');
}

function savingsAccountsOf(memberId) {
  return state.accounts.filter((a) => a.member_id === memberId && a.type === 'savings');
}

function cashAccount() {
  return state.accounts.find((a) => a.type === 'cash');
}

function accountLabel(accountId) {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return '';
  if (acc.type === 'cash') return t('overview_cash_label');
  const member = state.members.find((m) => m.id === acc.member_id);
  const memberName = member ? member.name : '';
  return acc.type === 'current' ? memberName : `${memberName} — ${acc.name}`;
}

function fadeOutThen(el, fn) {
  if (!el) { fn(); return; }
  el.classList.add('fade-out');
  setTimeout(fn, 150);
}

// ---------------------------------------------------------------
// Приватность: скрыть/показать суммы одной кнопкой
// ---------------------------------------------------------------

function applyPrivacyButton() {
  const btn = document.getElementById('btn-privacy');
  btn.textContent = privacyMode ? '🙈' : '👁️';
  btn.title = privacyMode ? t('privacy_show_title') : t('privacy_hide_title');
}

function togglePrivacy() {
  privacyMode = !privacyMode;
  document.body.classList.toggle('privacy-mode', privacyMode);
  applyPrivacyButton();
}

// ---------------------------------------------------------------
// Тема: светлая / тёмная / как в системе
// ---------------------------------------------------------------

function getTheme() {
  return localStorage.getItem('theme') || 'system';
}

function setTheme(mode) {
  localStorage.setItem('theme', mode);
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

function applyThemeButton() {
  const btn = document.getElementById('btn-theme');
  const mode = getTheme();
  btn.textContent = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '🌓';
  const modeLabel = mode === 'dark' ? t('theme_dark') : mode === 'light' ? t('theme_light') : t('theme_system');
  btn.title = `${t('theme_btn_title')}: ${modeLabel}`;
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  setTheme(next);
  applyThemeButton();
  renderCurrentTab();
}

// ---------------------------------------------------------------
// Язык интерфейса
// ---------------------------------------------------------------

function applyStaticText() {
  document.title = t('app_title');
  document.getElementById('app-title-text').textContent = t('app_title');
  document.getElementById('btn-lang').title = t('lang_btn_title');
  applyPrivacyButton();
  applyThemeButton();
}

function openLanguageModal() {
  const current = getLang();
  const optionsHtml = LANGUAGES.map((l) => `
    <button type="button" class="lang-option ${l.code === current ? 'active' : ''}" data-code="${l.code}">${escapeHtml(l.label)}</button>
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

// ---------------------------------------------------------------
// Вкладки
// ---------------------------------------------------------------

const AVATAR_COLORS = ['#8a9a2e', '#c2861f', '#c2672c', '#5f7a34', '#6a52b3', '#3f8f82'];

function avatarColor(name) {
  const sum = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function renderTabs() {
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

function renderCurrentTab() {
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

// ---------------------------------------------------------------
// Вкладка "Общий статус"
// ---------------------------------------------------------------

function computeLastMonthSummary() {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fromStr = firstOfLastMonth.toISOString().slice(0, 10);
  const toStr = firstOfThisMonth.toISOString().slice(0, 10);

  let income = 0;
  let expense = 0;
  state.transactions.forEach((tx) => {
    if (tx.date >= fromStr && tx.date < toStr) {
      if (tx.type === 'income') income += Number(tx.amount);
      else expense += Number(tx.amount);
    }
  });
  return { income, expense, net: income - expense, monthKey: fromStr.slice(0, 7) };
}

function renderMonthlySummaryBanner() {
  const summary = computeLastMonthSummary();
  if (summary.income === 0 && summary.expense === 0) return '';
  if (localStorage.getItem('summaryDismissed') === summary.monthKey) return '';

  return `
    <div class="summary-banner" id="month-summary-banner" data-month="${summary.monthKey}">
      <div>
        <strong>${t('summary_last_month_title')}</strong>
        <div class="tx-meta">
          ${t('summary_income_label')}: <span class="money-value">${formatMoney(summary.income)}</span> ·
          ${t('summary_expense_label')}: <span class="money-value">${formatMoney(summary.expense)}</span> ·
          ${t('summary_net_label')}: <span class="money-value">${formatMoney(summary.net)}</span>
        </div>
      </div>
      <button class="summary-banner-close" id="summary-banner-close" title="${t('btn_close')}">✕</button>
    </div>
  `;
}

function renderOverview() {
  const cash = cashAccount();
  const memberBalances = state.members.map((m) => ({
    member: m,
    balance: accountBalance(currentAccountOf(m.id)),
    color: avatarColor(m.name),
  }));
  const savingsTotal = state.accounts
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + accountBalance(a), 0);
  const cashBalance = accountBalance(cash);
  const liquidTotal = memberBalances.reduce((s, x) => s + x.balance, 0) + cashBalance;

  return `
    ${renderMonthlySummaryBanner()}
    <div class="card gauge-card">
      <div id="overview-total-gauge"></div>
    </div>
    <div class="summary-grid">
      ${memberBalances.map((x) => `
        <div class="card balance-card accent" style="border-left-color:${x.color}">
          <div class="label">${escapeHtml(x.member.name)}${t('overview_current_suffix')}</div>
          <div class="amount money-value">${formatMoney(x.balance)}</div>
        </div>`).join('')}
      <div class="card balance-card accent" style="border-left-color:var(--accent-cash)">
        <div class="label">${t('overview_cash_label')}</div>
        <div class="amount money-value">${formatMoney(cashBalance)}</div>
      </div>
      <div class="card balance-card accent" style="border-left-color:var(--accent-savings)">
        <div class="label">${t('overview_savings_total')}</div>
        <div class="amount money-value">${formatMoney(savingsTotal)}</div>
      </div>
    </div>

    ${renderPeriodControl()}
    <div class="card chart-card">
      <div class="section-title" style="margin-top:0;"><h2>${t('analytics_line_title')}</h2></div>
      <div id="overview-line-chart"></div>
    </div>
    <div class="card chart-card">
      <div class="section-title" style="margin-top:0;"><h2>${t('analytics_pie_title')}</h2></div>
      <div id="overview-pie-chart"></div>
      <div id="overview-expense-table"></div>
    </div>

    <div class="section-title">
      <h2>${t('overview_cash_ops_title')}</h2>
      <button class="btn btn-small" id="btn-add-cash-tx">${t('add_transaction_btn')}</button>
    </div>
    ${cash ? renderTxSection(cash.id) : `<div class="empty-hint">${t('empty_account_not_found')}</div>`}
  `;
}

function attachOverviewEvents() {
  const closeBtn = document.getElementById('summary-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const banner = document.getElementById('month-summary-banner');
      localStorage.setItem('summaryDismissed', banner.dataset.month);
      banner.remove();
    });
  }

  attachPeriodControl();
  renderLiquidLineChart('overview-line-chart');
  drawPieChart('overview-pie-chart', state.transactions);
  renderExpenseTable('overview-expense-table', state.transactions);

  const cash = cashAccount();
  const savingsTotal = state.accounts
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + accountBalance(a), 0);
  const liquidTotal = state.members
    .reduce((s, m) => s + accountBalance(currentAccountOf(m.id)), 0) + accountBalance(cash);
  drawRadialGauge('overview-total-gauge', {
    fraction: liquidTotal / ((liquidTotal + savingsTotal) || 1),
    centerHtml: `<span class="money-value">${formatMoney(liquidTotal)}</span>`,
    label: t('overview_liquid_total'),
  });

  if (!cash) return;
  document.getElementById('btn-add-cash-tx').addEventListener('click', () => openTransactionModal({ accountId: cash.id }));
  attachTxListEvents(cash.id);
}

// ---------------------------------------------------------------
// Вкладка члена семьи
// ---------------------------------------------------------------

function renderMemberTab(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return `<div class="empty-hint">${t('empty_member_not_found')}</div>`;

  const account = currentAccountOf(memberId);
  const savings = savingsAccountsOf(memberId);

  let selected = memberSubTab[memberId] || 'current';
  if (selected !== 'current' && !savings.find((s) => s.id === selected)) {
    selected = 'current';
  }
  memberSubTab[memberId] = selected;

  const subtabsHtml = `
    <div class="subtabs" id="member-subtabs">
      <button class="subtab-btn ${selected === 'current' ? 'active' : ''}" data-subtab="current">${t('subtab_bank')}</button>
      ${savings.map((s) => `<button class="subtab-btn ${selected === s.id ? 'active' : ''}" data-subtab="${s.id}">${s.icon ? s.icon + ' ' : ''}${escapeHtml(s.name)}</button>`).join('')}
      <button class="subtab-btn subtab-add" id="btn-add-savings" title="${t('add_savings_btn')}">+</button>
    </div>
  `;

  const contentHtml = selected === 'current'
    ? renderBankSubtab(member, account)
    : renderSavingsSubtab(savings.find((s) => s.id === selected));

  return subtabsHtml + contentHtml;
}

function renderBankSubtab(member, account) {
  const balance = accountBalance(account);
  return `
    <div class="card balance-card">
      <div class="label">${t('member_current_prefix')}${escapeHtml(member.name)}</div>
      <div class="amount money-value">${formatMoney(balance)}</div>
    </div>

    ${account ? `
      ${renderPeriodControl()}
      <div class="card chart-card">
        <div class="section-title" style="margin-top:0;"><h2>${t('chart_balance_title')}</h2></div>
        <div id="member-line-chart"></div>
      </div>
      <div class="card chart-card">
        <div class="section-title" style="margin-top:0;"><h2>${t('analytics_pie_title')}</h2></div>
        <div id="member-pie-chart"></div>
        <div id="member-expense-table"></div>
      </div>
    ` : ''}

    <div class="section-title">
      <h2>${t('section_operations')}</h2>
      <button class="btn btn-small" id="btn-add-tx">${t('add_transaction_btn')}</button>
    </div>
    ${account ? renderTxSection(account.id) : `<div class="empty-hint">${t('empty_account_not_found')}</div>`}
  `;
}

function renderSavingsSubtab(account) {
  if (!account) return `<div class="empty-hint">${t('empty_account_not_found')}</div>`;
  const balance = accountBalance(account);
  const cps = checkpointsSorted(account.id, 'desc');

  let deltaHtml = `<span class="tx-meta">${t('savings_no_checkpoints_yet')}</span>`;
  if (cps.length >= 2) {
    const delta = Number(cps[0].balance) - Number(cps[1].balance);
    const cls = delta >= 0 ? 'income' : 'expense';
    const sign = delta >= 0 ? '+' : '−';
    deltaHtml = `<span class="tx-amount money-value ${cls}">${sign} ${formatMoney(Math.abs(delta))}</span> <span class="tx-meta">${t('savings_since')}${formatDate(cps[1].date)}</span>`;
  } else if (cps.length === 1) {
    deltaHtml = `<span class="tx-meta">${t('savings_checkpoint_from')}${formatDate(cps[0].date)}</span>`;
  }

  return `
    <div class="card balance-card savings-header-card">
      <div class="savings-header-top">
        <div>
          <div class="label">${account.icon ? `<span class="item-icon">${account.icon}</span>` : ''}${escapeHtml(account.name)}</div>
          <div class="amount money-value">${formatMoney(balance)}</div>
          <div class="savings-delta">${deltaHtml}</div>
        </div>
        <div class="tx-actions">
          <button class="icon-btn" id="btn-rename-savings" title="${t('edit_title')}">✏️</button>
          <button class="icon-btn" id="btn-delete-savings" title="${t('delete_title')}">🗑️</button>
        </div>
      </div>
    </div>

    ${cps.length >= 2 ? `
      ${renderPeriodControl()}
      <div class="card chart-card">
        <div class="section-title" style="margin-top:0;"><h2>${t('chart_balance_title')}</h2></div>
        <div id="savings-line-chart"></div>
      </div>
    ` : ''}

    <div class="section-title">
      <h2>${t('section_checkpoints')}</h2>
      <button class="btn btn-small" id="btn-add-checkpoint">${t('add_checkpoint_btn')}</button>
    </div>
    <div id="checkpoint-list">${renderCheckpointRows(cps)}</div>
  `;
}

function renderCheckpointRows(cps) {
  if (!cps.length) return `<div class="empty-hint">${t('empty_no_checkpoints')}</div>`;
  return cps.map((c, idx) => {
    let deltaHtml = `<span class="tx-meta">${t('checkpoint_start')}</span>`;
    if (idx < cps.length - 1) {
      const delta = Number(c.balance) - Number(cps[idx + 1].balance);
      const cls = delta >= 0 ? 'income' : 'expense';
      const sign = delta >= 0 ? '+' : '−';
      deltaHtml = `<span class="tx-amount money-value ${cls}">${sign} ${formatMoney(Math.abs(delta))}</span>`;
    }
    return `
      <div class="tx-card" data-cp-id="${c.id}">
        <div class="tx-info">
          <span class="tx-category money-value">${formatMoney(c.balance)}</span>
          <span class="tx-meta">${formatDate(c.date)}${c.comment ? ' · ' + escapeHtml(c.comment) : ''}</span>
        </div>
        ${deltaHtml}
        <div class="tx-actions">
          <button class="icon-btn cp-edit" title="${t('edit_title')}">✏️</button>
          <button class="icon-btn cp-delete" title="${t('delete_title')}">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function attachMemberEvents(memberId) {
  const account = currentAccountOf(memberId);
  const savings = savingsAccountsOf(memberId);
  const selected = memberSubTab[memberId] || 'current';

  document.querySelectorAll('#member-subtabs .subtab-btn[data-subtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      memberSubTab[memberId] = btn.dataset.subtab;
      renderCurrentTab();
    });
  });

  document.getElementById('btn-add-savings').addEventListener('click', (e) => {
    e.stopPropagation();
    openNewSavingsModal({ memberId });
  });

  if (selected === 'current') {
    if (account) {
      attachPeriodControl();
      renderAccountBalanceChart('member-line-chart', account);
      const memberTxs = state.transactions.filter((tx) => tx.account_id === account.id);
      drawPieChart('member-pie-chart', memberTxs);
      renderExpenseTable('member-expense-table', memberTxs);
      document.getElementById('btn-add-tx').addEventListener('click', () => openTransactionModal({ accountId: account.id }));
      attachTxListEvents(account.id);
    }
    return;
  }

  const savAccount = savings.find((s) => s.id === selected);
  if (!savAccount) return;

  if (document.getElementById('savings-line-chart')) {
    attachPeriodControl();
    renderCheckpointBalanceChart('savings-line-chart', savAccount);
  }

  document.getElementById('btn-rename-savings').addEventListener('click', () => openRenameSavingsModal(savAccount.id));
  document.getElementById('btn-delete-savings').addEventListener('click', async () => {
    if (!confirm(t('confirm_delete_savings'))) return;
    memberSubTab[memberId] = 'current';
    await Api.deleteAccount(savAccount.id);
    await loadAll();
  });
  document.getElementById('btn-add-checkpoint').addEventListener('click', () => {
    openCheckpointModal({ accountId: savAccount.id });
  });

  document.querySelectorAll('#checkpoint-list .tx-card').forEach((row) => {
    const cpId = row.dataset.cpId;
    row.querySelector('.cp-edit').addEventListener('click', () => {
      const cp = state.checkpoints.find((x) => x.id === cpId);
      openCheckpointModal({ accountId: savAccount.id, checkpoint: cp });
    });
    row.querySelector('.cp-delete').addEventListener('click', () => {
      if (!confirm(t('confirm_delete_checkpoint'))) return;
      fadeOutThen(row, async () => {
        await Api.deleteCheckpoint(cpId);
        await loadAll();
      });
    });
  });
}

// ---------------------------------------------------------------
// Список операций: фильтры + сам список (общий для банка и наличности)
// ---------------------------------------------------------------

function ensureTxFilter(accountId) {
  if (!txFilters[accountId]) txFilters[accountId] = { categoryId: '', dateFrom: '', dateTo: '', search: '' };
  return txFilters[accountId];
}

function filteredTransactions(accountId) {
  const f = ensureTxFilter(accountId);
  return state.transactions
    .filter((tx) => tx.account_id === accountId)
    .filter((tx) => !f.categoryId || tx.category_id === f.categoryId)
    .filter((tx) => !f.dateFrom || tx.date >= f.dateFrom)
    .filter((tx) => !f.dateTo || tx.date <= f.dateTo)
    .filter((tx) => !f.search || (tx.comment || '').toLowerCase().includes(f.search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

function renderFilterBar(accountId) {
  const f = ensureTxFilter(accountId);
  const cats = state.categories.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="filter-bar" id="filter-bar-${accountId}">
      <select class="f-category">
        <option value="">${t('filter_category_all')}</option>
        ${cats.map((c) => `<option value="${c.id}" ${f.categoryId === c.id ? 'selected' : ''}>${c.icon ? c.icon + ' ' : ''}${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <input type="date" class="f-date-from" value="${f.dateFrom}" title="${t('filter_date_from')}" />
      <input type="date" class="f-date-to" value="${f.dateTo}" title="${t('filter_date_to')}" />
      <input type="text" class="f-search" placeholder="${t('filter_search_placeholder')}" value="${escapeHtml(f.search)}" />
      <button type="button" class="btn btn-ghost btn-small f-clear">${t('filter_clear')}</button>
    </div>
  `;
}

function renderTxSection(accountId) {
  if (!accountId) return `<div class="empty-hint">${t('empty_account_not_found')}</div>`;
  return `${renderFilterBar(accountId)}<div id="tx-list-${accountId}">${renderTxListRows(accountId)}</div>`;
}

function renderTxListRows(accountId) {
  const txs = filteredTransactions(accountId);
  if (txs.length === 0) return `<div class="empty-hint">${t('empty_no_transactions')}</div>`;

  return txs.map((tx) => {
    const cat = state.categories.find((c) => c.id === tx.category_id);
    const catIcon = cat && cat.icon ? cat.icon + ' ' : '';
    const catName = cat ? cat.name : t('no_category_label');
    const sign = tx.type === 'income' ? '+' : '−';
    return `
      <div class="tx-card" data-tx-id="${tx.id}">
        <div class="tx-info">
          <span class="tx-category">${catIcon}${escapeHtml(catName)}</span>
          <span class="tx-meta">${formatDate(tx.date)}${tx.comment ? ' · ' + escapeHtml(tx.comment) : ''}</span>
        </div>
        <div class="tx-amount money-value ${tx.type}">${sign} ${formatMoney(tx.amount)}</div>
        <div class="tx-actions">
          <button class="icon-btn tx-edit" title="${t('edit_title')}">✏️</button>
          <button class="icon-btn tx-delete" title="${t('delete_title')}">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function attachFilterBarEvents(accountId) {
  const bar = document.getElementById(`filter-bar-${accountId}`);
  if (!bar) return;
  const f = ensureTxFilter(accountId);
  bar.querySelector('.f-category').addEventListener('change', (e) => { f.categoryId = e.target.value; renderCurrentTab(); });
  bar.querySelector('.f-date-from').addEventListener('change', (e) => { f.dateFrom = e.target.value; renderCurrentTab(); });
  bar.querySelector('.f-date-to').addEventListener('change', (e) => { f.dateTo = e.target.value; renderCurrentTab(); });
  bar.querySelector('.f-search').addEventListener('change', (e) => { f.search = e.target.value; renderCurrentTab(); });
  bar.querySelector('.f-clear').addEventListener('click', () => {
    txFilters[accountId] = { categoryId: '', dateFrom: '', dateTo: '', search: '' };
    renderCurrentTab();
  });
}

function attachTxListEvents(accountId) {
  const container = document.getElementById(`tx-list-${accountId}`);
  if (container) {
    container.querySelectorAll('.tx-card').forEach((card) => {
      const txId = card.dataset.txId;
      card.querySelector('.tx-edit').addEventListener('click', () => {
        const tx = state.transactions.find((t) => t.id === txId);
        openTransactionModal({ accountId, transaction: tx });
      });
      card.querySelector('.tx-delete').addEventListener('click', () => {
        if (!confirm(t('confirm_delete_transaction'))) return;
        fadeOutThen(card, async () => {
          await Api.deleteTransaction(txId);
          await loadAll();
        });
      });
    });
  }
  attachFilterBarEvents(accountId);
}

// ---------------------------------------------------------------
// Модалки
// ---------------------------------------------------------------

function openModal(innerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('modal-root').appendChild(overlay);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

function renderIconPicker(pickerId, selected) {
  return `<div class="icon-picker" id="${pickerId}">${ICON_CHOICES.map((ic) => `<button type="button" data-icon="${ic}" class="${ic === selected ? 'active' : ''}">${ic}</button>`).join('')}</div>`;
}

// Возвращает функцию-геттер текущей выбранной иконки.
function wireIconPicker(pickerId, initial) {
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

// ---- Модалка операции (доход/расход) ----

function openTransactionModal({ accountId, transaction }) {
  const isEdit = !!transaction;
  let type = transaction ? transaction.type : 'expense';

  const categoryOptions = (ty) => {
    const options = state.categories
      .filter((c) => c.type === ty)
      .map((c) => `<option value="${c.id}" ${transaction && transaction.category_id === c.id ? 'selected' : ''}>${c.icon ? c.icon + ' ' : ''}${escapeHtml(c.name)}</option>`)
      .join('');
    return `<option value="">${t('no_category_option')}</option>${options}`;
  };

  openModal(`
    <h3>${isEdit ? t('tx_modal_edit_title') : t('tx_modal_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_type')}</label>
      <div class="type-toggle" id="tx-type-toggle">
        <button type="button" data-type="expense" class="${type === 'expense' ? 'active' : ''}">${t('type_expense')}</button>
        <button type="button" data-type="income" class="${type === 'income' ? 'active' : ''}">${t('type_income')}</button>
      </div>
    </div>
    <div class="form-row">
      <label>${t('field_category')}</label>
      <select id="tx-category">${categoryOptions(type)}</select>
    </div>
    <div class="form-row">
      <label>${t('field_amount')}</label>
      <input type="number" id="tx-amount" min="0" step="0.01" value="${transaction ? transaction.amount : ''}" />
    </div>
    <div class="form-row">
      <label>${t('field_date')}</label>
      <input type="date" id="tx-date" value="${transaction ? transaction.date : todayStr()}" />
    </div>
    <div class="form-row">
      <label>${t('field_comment')}</label>
      <input type="text" id="tx-comment" value="${transaction && transaction.comment ? escapeHtml(transaction.comment) : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="tx-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="tx-save">${t('btn_save')}</button>
    </div>
  `);

  const toggle = document.getElementById('tx-type-toggle');
  toggle.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      type = btn.dataset.type;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      document.getElementById('tx-category').innerHTML = categoryOptions(type);
    });
  });

  document.getElementById('tx-cancel').addEventListener('click', closeModal);
  document.getElementById('tx-save').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;
    const category_id = document.getElementById('tx-category').value || null;
    const comment = document.getElementById('tx-comment').value.trim();

    if (!amount || amount <= 0) { alert(t('err_amount_positive')); return; }
    if (!date) { alert(t('err_date_required')); return; }

    try {
      if (isEdit) {
        await Api.updateTransaction(transaction.id, { type, category_id, amount, date, comment });
      } else {
        await Api.addTransaction({ account_id: accountId, category_id, type, amount, date, comment });
      }
      closeModal();
      await loadAll();
    } catch (err) {
      alert(t('err_tx_save_failed') + err.message);
    }
  });
}

// ---- Копилки: создание, переименование, история чекапов ----

function openNewSavingsModal({ memberId }) {
  openModal(`
    <h3>${t('savings_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_name')}</label>
      <input type="text" id="new-sav-name" placeholder="${t('name_placeholder_example')}" />
    </div>
    <div class="form-row">
      <label>${t('field_current_amount')}</label>
      <input type="number" id="new-sav-balance" step="0.01" />
    </div>
    <div class="form-row">
      <label>${t('field_date')}</label>
      <input type="date" id="new-sav-date" value="${todayStr()}" />
    </div>
    <div class="form-row">
      <label>${t('field_comment_optional')}</label>
      <input type="text" id="new-sav-comment" />
    </div>
    <div class="form-row">
      <label>${t('icon_picker_label')}</label>
      ${renderIconPicker('new-sav-icon-picker', null)}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="new-sav-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="new-sav-save">${t('btn_create')}</button>
    </div>
  `);

  const getIcon = wireIconPicker('new-sav-icon-picker', null);

  document.getElementById('new-sav-cancel').addEventListener('click', closeModal);
  document.getElementById('new-sav-save').addEventListener('click', async () => {
    const name = document.getElementById('new-sav-name').value.trim();
    const balance = parseFloat(document.getElementById('new-sav-balance').value);
    const date = document.getElementById('new-sav-date').value;
    const comment = document.getElementById('new-sav-comment').value.trim();

    if (!name) { alert(t('err_savings_name_required')); return; }
    if (isNaN(balance)) { alert(t('err_amount_required')); return; }
    if (!date) { alert(t('err_date_required')); return; }

    try {
      const account = await Api.addAccount({ member_id: memberId, type: 'savings', name, initial_balance: 0, icon: getIcon() });
      await Api.addCheckpoint({ account_id: account.id, date, balance, comment });
      closeModal();
      await loadAll();
    } catch (err) {
      alert(t('err_savings_create_failed') + err.message);
    }
  });
}

function openRenameSavingsModal(accountId) {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return;
  openModal(`
    <h3>${t('savings_rename_title')}</h3>
    <div class="form-row">
      <label>${t('field_name')}</label>
      <input type="text" id="rename-input" value="${escapeHtml(account.name)}" />
    </div>
    <div class="form-row">
      <label>${t('icon_picker_label')}</label>
      ${renderIconPicker('rename-icon-picker', account.icon)}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="rename-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="rename-save">${t('btn_save')}</button>
    </div>
  `);

  const getIcon = wireIconPicker('rename-icon-picker', account.icon);

  document.getElementById('rename-cancel').addEventListener('click', closeModal);
  document.getElementById('rename-save').addEventListener('click', async () => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name) { alert(t('err_name_empty')); return; }
    try {
      await Api.updateAccount(accountId, { name, icon: getIcon() });
      closeModal();
      await loadAll();
    } catch (err) {
      alert(t('err_savings_rename_failed') + err.message);
    }
  });
}

// Модалка добавления/редактирования одного чекапа. Список чекапов
// живёт прямо на странице копилки и обновляется через общий loadAll().
function openCheckpointModal({ accountId, checkpoint }) {
  const isEdit = !!checkpoint;
  openModal(`
    <h3>${isEdit ? t('checkpoint_edit_title') : t('checkpoint_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_date')}</label>
      <input type="date" id="cp-date" value="${checkpoint ? checkpoint.date : todayStr()}" />
    </div>
    <div class="form-row">
      <label>${t('field_balance')}</label>
      <input type="number" id="cp-balance" step="0.01" value="${checkpoint ? checkpoint.balance : ''}" />
    </div>
    <div class="form-row">
      <label>${t('field_comment')}</label>
      <input type="text" id="cp-comment" value="${checkpoint && checkpoint.comment ? escapeHtml(checkpoint.comment) : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cp-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="cp-save">${t('btn_save')}</button>
    </div>
  `);

  document.getElementById('cp-cancel').addEventListener('click', closeModal);

  document.getElementById('cp-save').addEventListener('click', async () => {
    const date = document.getElementById('cp-date').value;
    const balance = parseFloat(document.getElementById('cp-balance').value);
    const comment = document.getElementById('cp-comment').value.trim();

    if (!date) { alert(t('err_date_required')); return; }
    if (isNaN(balance)) { alert(t('err_amount_required')); return; }

    try {
      if (isEdit) {
        await Api.updateCheckpoint(checkpoint.id, { date, balance, comment });
      } else {
        await Api.addCheckpoint({ account_id: accountId, date, balance, comment });
      }
      closeModal();
      await loadAll();
    } catch (err) {
      alert(t('err_checkpoint_save_failed') + err.message);
    }
  });
}

// ---------------------------------------------------------------
// Вкладка "Настройки": категории, экспорт, импорт из банка
// ---------------------------------------------------------------

function renderSettingsTab() {
  const income = state.categories.filter((c) => c.type === 'income');
  const expense = state.categories.filter((c) => c.type === 'expense');
  const catRow = (c) => `
    <div class="category-row" data-id="${c.id}">
      <span class="item-icon">${c.icon || ''}</span>
      <input type="text" value="${escapeHtml(c.name)}" class="cat-name-input" />
      <button class="icon-btn cat-save" title="${t('save_name_title')}">💾</button>
      <button class="icon-btn cat-delete" title="${t('delete_title')}">🗑️</button>
    </div>`;

  return `
    <div class="settings-section">
      <h2>${t('settings_categories_title')}</h2>
      <div class="category-group-title">${t('categories_income_group')}</div>
      <div id="cat-income-list">${income.map(catRow).join('') || `<div class="empty-hint">${t('empty_no_categories')}</div>`}</div>
      <div class="category-group-title">${t('categories_expense_group')}</div>
      <div id="cat-expense-list">${expense.map(catRow).join('') || `<div class="empty-hint">${t('empty_no_categories')}</div>`}</div>

      <div class="category-group-title">${t('add_category_title')}</div>
      <div class="form-row">
        <label>${t('field_name')}</label>
        <input type="text" id="new-cat-name" />
      </div>
      <div class="form-row">
        <label>${t('field_type_simple')}</label>
        <div class="type-toggle" id="new-cat-type-toggle">
          <button type="button" data-type="expense" class="active">${t('type_expense')}</button>
          <button type="button" data-type="income">${t('type_income')}</button>
        </div>
      </div>
      <div class="form-row">
        <label>${t('icon_picker_label')}</label>
        ${renderIconPicker('new-cat-icon-picker', null)}
      </div>
      <button class="btn" id="cat-add">${t('btn_add')}</button>
    </div>

    <div class="settings-section">
      <h2>${t('settings_data_title')}</h2>
      <button class="btn btn-ghost btn-small" id="btn-export-tx" style="margin-inline-end:8px;">${t('export_transactions_btn')}</button>
      <button class="btn btn-ghost btn-small" id="btn-export-cp">${t('export_checkpoints_btn')}</button>
    </div>

    <div class="settings-section">
      <h2>${t('import_bank_title')}</h2>
      <p class="tx-meta">${t('import_bank_hint')}</p>
      ${renderImportWidget()}
    </div>
  `;
}

function attachSettingsEvents() {
  const getNewCatIcon = wireIconPicker('new-cat-icon-picker', null);

  let newType = 'expense';
  const typeToggle = document.getElementById('new-cat-type-toggle');
  typeToggle.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      newType = btn.dataset.type;
      typeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('cat-add').addEventListener('click', async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) { alert(t('err_category_name_required')); return; }
    try {
      await Api.addCategory(name, newType, getNewCatIcon());
      await loadAll();
    } catch (err) {
      alert(t('err_category_add_failed') + err.message);
    }
  });

  attachCatRowEvents('cat-income-list');
  attachCatRowEvents('cat-expense-list');

  document.getElementById('btn-export-tx').addEventListener('click', exportTransactionsCsv);
  document.getElementById('btn-export-cp').addEventListener('click', exportCheckpointsCsv);

  attachImportWidgetEvents();
}

function attachCatRowEvents(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.category-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('.cat-save').addEventListener('click', async () => {
      const name = row.querySelector('.cat-name-input').value.trim();
      if (!name) { alert(t('err_name_empty')); return; }
      try {
        await Api.updateCategory(id, { name });
        await loadAll();
      } catch (err) {
        alert(t('err_category_rename_failed') + err.message);
      }
    });
    row.querySelector('.cat-delete').addEventListener('click', () => {
      if (!confirm(t('confirm_delete_category'))) return;
      fadeOutThen(row, async () => {
        try {
          await Api.deleteCategory(id);
          await loadAll();
        } catch (err) {
          alert(t('err_category_delete_failed') + err.message);
        }
      });
    });
  });
}

// ---- Экспорт CSV ----

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv(filename, rows) {
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

function exportTransactionsCsv() {
  const header = ['Date', 'Account', 'Type', 'Category', 'Amount', 'Comment'];
  const rows = state.transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((tx) => {
      const cat = state.categories.find((c) => c.id === tx.category_id);
      return [tx.date, accountLabel(tx.account_id), tx.type, cat ? cat.name : '', tx.amount, tx.comment || ''];
    });
  downloadCsv('transactions.csv', [header, ...rows]);
}

function exportCheckpointsCsv() {
  const header = ['Date', 'Account', 'Balance', 'Comment'];
  const rows = state.checkpoints
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => [c.date, accountLabel(c.account_id), c.balance, c.comment || '']);
  downloadCsv('savings_history.csv', [header, ...rows]);
}

// ---- Импорт банковской выписки (Excel/CSV) ----

function importableAccountOptions() {
  return state.accounts
    .filter((a) => a.type === 'current' || a.type === 'cash')
    .map((a) => `<option value="${a.id}">${escapeHtml(accountLabel(a.id))}</option>`)
    .join('');
}

function renderImportWidget() {
  return `
    <div class="form-row">
      <label>${t('import_choose_account')}</label>
      <select id="import-account-select">${importableAccountOptions()}</select>
    </div>
    <div class="dropzone" id="import-dropzone">${t('import_drop_hint')}</div>
    <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none" />
    <div id="import-mapping" style="display:none;"></div>
  `;
}

function attachImportWidgetEvents() {
  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
  });
}

function parseFlexibleDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseFlexibleAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/[₪$€\s]/g, '');
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

function guessColumn(parser) {
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < importHeaders.length; c++) {
    let score = 0;
    importParsedRows.slice(0, 15).forEach((row) => { if (parser(row[c]) !== null) score++; });
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function guessDescColumn() {
  let best = -1;
  let bestLen = 0;
  for (let c = 0; c < importHeaders.length; c++) {
    const sample = importParsedRows.slice(0, 15);
    let totalLen = 0;
    let numericCount = 0;
    sample.forEach((row) => {
      const v = row[c];
      const s = v === undefined ? '' : String(v);
      totalLen += s.length;
      if (parseFlexibleAmount(v) !== null && s.length < 12) numericCount++;
    });
    const avgLen = totalLen / (sample.length || 1);
    if (numericCount < sample.length / 2 && avgLen > bestLen) { bestLen = avgLen; best = c; }
  }
  return best;
}

function handleImportFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  const reader = new FileReader();
  reader.onerror = () => alert(t('err_file_read') + reader.error);
  reader.onload = (e) => {
    try {
      const wb = isCsv
        ? XLSX.read(e.target.result, { type: 'string' })
        : XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
      if (!rows.length) { alert(t('err_import_no_rows')); return; }
      importHeaders = rows[0].map((h, i) => (h === undefined || h === '' ? `Col ${i + 1}` : String(h)));
      importParsedRows = rows.slice(1).filter((r) => r.some((cell) => cell !== undefined && cell !== ''));
      if (!importParsedRows.length) { alert(t('err_import_no_rows')); return; }
      renderImportMapping();
    } catch (err) {
      alert(t('err_file_read') + err.message);
    }
  };
  if (isCsv) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function renderImportMapping() {
  const wrap = document.getElementById('import-mapping');
  wrap.style.display = 'block';

  const colOptions = (selectedIdx) => importHeaders.map((h, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
  const colOptionsWithNone = (selectedIdx) => `<option value="-1">${t('import_column_none')}</option>${colOptions(selectedIdx)}`;

  const dateGuess = guessColumn(parseFlexibleDate);
  const amountGuess = guessColumn(parseFlexibleAmount);

  wrap.innerHTML = `
    <div class="form-row">
      <label>${t('import_column_date')}</label>
      <select id="imp-col-date">${colOptions(dateGuess)}</select>
    </div>
    <div class="form-row">
      <label>${t('import_amount_mode')}</label>
      <div class="type-toggle" id="imp-amount-mode">
        <button type="button" data-mode="single" class="active">${t('import_amount_single')}</button>
        <button type="button" data-mode="split">${t('import_amount_split')}</button>
      </div>
    </div>
    <div class="form-row" id="imp-single-wrap">
      <label>${t('import_column_amount')}</label>
      <select id="imp-col-amount">${colOptions(amountGuess)}</select>
    </div>
    <div class="form-row" id="imp-split-wrap" style="display:none;">
      <label>${t('import_column_credit')}</label>
      <select id="imp-col-credit">${colOptionsWithNone(-1)}</select>
      <label>${t('import_column_debit')}</label>
      <select id="imp-col-debit">${colOptionsWithNone(-1)}</select>
    </div>
    <div class="form-row">
      <label>${t('import_column_desc')}</label>
      <select id="imp-col-desc">${colOptionsWithNone(guessDescColumn())}</select>
    </div>
    <div>${t('import_rows_found_prefix')}${importParsedRows.length}</div>
    <div class="import-table-wrap" id="imp-preview"></div>
    <div class="modal-actions" style="margin-top:12px;">
      <span></span>
      <button class="btn" id="imp-do-import">${t('btn_import')}</button>
    </div>
  `;

  document.getElementById('imp-amount-mode').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('imp-amount-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      const isSplit = btn.dataset.mode === 'split';
      document.getElementById('imp-single-wrap').style.display = isSplit ? 'none' : '';
      document.getElementById('imp-split-wrap').style.display = isSplit ? '' : 'none';
      renderImportPreview();
    });
  });

  ['imp-col-date', 'imp-col-amount', 'imp-col-credit', 'imp-col-debit', 'imp-col-desc'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderImportPreview);
  });

  document.getElementById('imp-do-import').addEventListener('click', doImport);

  renderImportPreview();
}

function readImportConfig() {
  const dateCol = parseInt(document.getElementById('imp-col-date').value, 10);
  const mode = document.querySelector('#imp-amount-mode button.active').dataset.mode;
  const descCol = parseInt(document.getElementById('imp-col-desc').value, 10);
  const config = { dateCol, mode, descCol };
  if (mode === 'single') {
    config.amountCol = parseInt(document.getElementById('imp-col-amount').value, 10);
  } else {
    config.creditCol = parseInt(document.getElementById('imp-col-credit').value, 10);
    config.debitCol = parseInt(document.getElementById('imp-col-debit').value, 10);
  }
  return config;
}

function buildImportRows(config) {
  const results = [];
  importParsedRows.forEach((row) => {
    const date = parseFlexibleDate(row[config.dateCol]);
    let amount = null;
    let type = null;
    if (config.mode === 'single') {
      const raw = parseFlexibleAmount(row[config.amountCol]);
      if (raw !== null && raw !== 0) { amount = Math.abs(raw); type = raw >= 0 ? 'income' : 'expense'; }
    } else {
      const credit = config.creditCol >= 0 ? parseFlexibleAmount(row[config.creditCol]) : null;
      const debit = config.debitCol >= 0 ? parseFlexibleAmount(row[config.debitCol]) : null;
      if (credit && credit !== 0) { amount = Math.abs(credit); type = 'income'; }
      else if (debit && debit !== 0) { amount = Math.abs(debit); type = 'expense'; }
    }
    const comment = config.descCol >= 0 && row[config.descCol] !== undefined ? String(row[config.descCol]) : '';
    if (date && amount) results.push({ date, amount, type, comment });
  });
  return results;
}

function renderImportPreview() {
  const config = readImportConfig();
  const rows = buildImportRows(config);
  const wrap = document.getElementById('imp-preview');
  const preview = rows.slice(0, 50);
  wrap.innerHTML = `
    <table class="import-table">
      <thead><tr><th>${t('field_date')}</th><th>${t('field_type')}</th><th>${t('field_amount')}</th><th>${t('field_comment')}</th></tr></thead>
      <tbody>
        ${preview.map((r) => `<tr><td>${formatDate(r.date)}</td><td>${r.type === 'income' ? t('type_income') : t('type_expense')}</td><td>${formatMoney(r.amount)}</td><td>${escapeHtml(r.comment)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function doImport() {
  const accountId = document.getElementById('import-account-select').value;
  const config = readImportConfig();
  const rows = buildImportRows(config);
  if (!rows.length) { alert(t('err_import_no_rows')); return; }

  const payload = rows.map((r) => ({
    account_id: accountId,
    category_id: null,
    type: r.type,
    amount: r.amount,
    date: r.date,
    comment: r.comment || null,
  }));

  try {
    await Api.addTransactionsBulk(payload);
    await loadAll();
    alert(t('import_success_prefix') + payload.length);
  } catch (err) {
    alert(t('err_import_failed') + err.message);
  }
}

// ---------------------------------------------------------------
// Графики: общий выбор периода (с произвольным диапазоном месяцев)
// + переиспользуемые функции для пирога и линейного графика.
// Показываются прямо на нужной вкладке, а не в отдельном разделе.
// ---------------------------------------------------------------

function currentPeriodBounds() {
  if (chartPeriod === 'custom') {
    const from = chartCustomFrom ? `${chartCustomFrom}-01` : null;
    let to = null;
    if (chartCustomTo) {
      const [y, m] = chartCustomTo.split('-').map(Number);
      to = new Date(y, m, 1).toISOString().slice(0, 10); // первое число месяца, следующего за выбранным
    }
    return { from, to };
  }
  const now = new Date();
  if (chartPeriod === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: null };
  if (chartPeriod === '3m') return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: null };
  if (chartPeriod === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: null };
  return { from: null, to: null };
}

// Индексы [start, end] (включительно) внутри chronologically-отсортированного
// массива dates, попадающие в текущий период. null, если ничего не попало.
function periodIndexRange(dates) {
  const { from, to } = currentPeriodBounds();
  let start = 0;
  let end = dates.length - 1;
  if (from) {
    start = dates.findIndex((d) => d >= from);
    if (start === -1) return null;
  }
  if (to) {
    end = dates.length - 1;
    while (end >= start && dates[end] >= to) end--;
    if (end < start) return null;
  }
  return { start, end };
}

function renderPeriodControl() {
  const isCustom = chartPeriod === 'custom';
  return `
    <div class="chart-filter-row">
      <select id="period-select">
        <option value="all" ${chartPeriod === 'all' ? 'selected' : ''}>${t('analytics_period_all')}</option>
        <option value="month" ${chartPeriod === 'month' ? 'selected' : ''}>${t('analytics_period_month')}</option>
        <option value="3m" ${chartPeriod === '3m' ? 'selected' : ''}>${t('analytics_period_3m')}</option>
        <option value="year" ${chartPeriod === 'year' ? 'selected' : ''}>${t('analytics_period_year')}</option>
        <option value="custom" ${isCustom ? 'selected' : ''}>${t('analytics_period_custom')}</option>
      </select>
      <input type="month" id="period-from" value="${chartCustomFrom}" title="${t('filter_date_from')}" style="${isCustom ? '' : 'display:none;'}" />
      <input type="month" id="period-to" value="${chartCustomTo}" title="${t('filter_date_to')}" style="${isCustom ? '' : 'display:none;'}" />
    </div>
  `;
}

function attachPeriodControl() {
  const select = document.getElementById('period-select');
  if (!select) return;
  const fromEl = document.getElementById('period-from');
  const toEl = document.getElementById('period-to');
  select.addEventListener('change', () => {
    chartPeriod = select.value;
    renderCurrentTab();
  });
  fromEl.addEventListener('change', () => { chartCustomFrom = fromEl.value; renderCurrentTab(); });
  toEl.addEventListener('change', () => { chartCustomTo = toEl.value; renderCurrentTab(); });
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArc, 0, end.x, end.y, 'Z'].join(' ');
}

const PIE_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

// Группирует расходы по категории. Операции без категории (например, только
// что импортированные из банка и ещё не разобранные вручную) группируются по
// тексту описания — так сразу видно, на что уходят деньги, без разбора вручную.
function groupExpenses(transactions) {
  const { from, to } = currentPeriodBounds();
  const byKey = {};
  transactions.forEach((tx) => {
    if (tx.type !== 'expense') return;
    if (from && tx.date < from) return;
    if (to && tx.date >= to) return;

    let key;
    let label;
    let icon = '';
    if (tx.category_id) {
      const cat = state.categories.find((c) => c.id === tx.category_id);
      key = 'cat:' + tx.category_id;
      label = cat ? cat.name : t('no_category_label');
      icon = cat && cat.icon ? cat.icon + ' ' : '';
    } else {
      const desc = (tx.comment || '').trim();
      key = desc ? 'desc:' + desc.toLowerCase() : 'none';
      label = desc || t('no_category_label');
    }
    if (!byKey[key]) byKey[key] = { label, icon, amount: 0 };
    byKey[key].amount += Number(tx.amount);
  });
  return Object.values(byKey).sort((a, b) => b.amount - a.amount);
}

// transactions — уже отфильтрованный по нужному счёту/члену семьи список
// (или все state.transactions для семейного разреза); период применяется здесь.
function drawPieChart(rootId, transactions) {
  const root = document.getElementById(rootId);
  const entries = groupExpenses(transactions);
  if (!entries.length) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const colors = PIE_COLORS;

  let top = entries.slice(0, 7);
  const rest = entries.slice(7);
  if (rest.length) top.push({ label: '…', icon: '', amount: rest.reduce((s, e) => s + e.amount, 0) });

  const size = 220;
  const r = 90;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;

  const slices = top.map((entry, i) => {
    const fraction = entry.amount / total;
    const sweep = Math.min(fraction * 360, 359.99);
    const path = describeArc(cx, cy, r, angle, angle + sweep);
    angle += sweep;
    return { path, color: colors[i % colors.length], value: entry.amount, label: entry.label, icon: entry.icon, fraction };
  });

  const svg = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${t('analytics_pie_title')}">
      ${slices.map((p, i) => `<path d="${p.path}" fill="${p.color}" stroke="var(--chart-surface)" stroke-width="2" data-idx="${i}" class="pie-slice"></path>`).join('')}
    </svg>
  `;

  const legend = `
    <div class="chart-legend">
      ${slices.map((p) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${p.color}"></span>
          <span>${p.icon}${escapeHtml(p.label)} — <span class="money-value">${formatMoney(p.value)}</span> (${Math.round(p.fraction * 100)}%)</span>
        </div>`).join('')}
    </div>
  `;

  root.innerHTML = `<div class="chart-svg-wrap">${svg}<div class="chart-tooltip" id="${rootId}-tooltip"></div></div>${legend}`;

  const tooltip = document.getElementById(`${rootId}-tooltip`);
  root.querySelectorAll('.pie-slice').forEach((el, i) => {
    el.addEventListener('mousemove', (e) => {
      const p = slices[i];
      tooltip.style.display = 'block';
      tooltip.style.left = e.offsetX + 'px';
      tooltip.style.top = e.offsetY + 'px';
      tooltip.textContent = `${p.icon}${p.label}: ${formatMoney(p.value)}`;
    });
    el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });
}

// Таблица "на что и сколько": та же группировка, что и в пироге, но списком —
// удобно читать без вникания в детали, особенно сразу после импорта из банка,
// когда операции ещё не разложены по категориям вручную.
function renderExpenseTable(rootId, transactions) {
  const root = document.getElementById(rootId);
  const entries = groupExpenses(transactions);
  if (!entries.length) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const colors = PIE_COLORS;

  root.innerHTML = `
    <div class="expense-table">
      ${entries.map((e, i) => {
        const pct = total ? (e.amount / total) * 100 : 0;
        return `
          <div class="expense-row">
            <div class="expense-row-top">
              <span class="expense-row-label">${e.icon}${escapeHtml(e.label)}</span>
              <span class="expense-row-amount money-value">${formatMoney(e.amount)}</span>
            </div>
            <div class="expense-row-bar-track">
              <div class="expense-row-bar" style="width:${pct.toFixed(1)}%; background:${colors[i % colors.length]}"></div>
            </div>
            <div class="expense-row-pct">${pct.toFixed(1)}%</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

// Общая (семейная) серия: суммарный ликвидный баланс + баланс каждого счёта.
function computeLiquidSeries() {
  const liquidAccounts = state.accounts.filter((a) => a.type === 'current' || a.type === 'cash');
  if (!liquidAccounts.length) return null;

  const perAccountPoints = {};
  liquidAccounts.forEach((acc) => {
    const txs = state.transactions
      .filter((tx) => tx.account_id === acc.id)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
    let running = Number(acc.initial_balance);
    const points = [];
    txs.forEach((tx) => {
      running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      points.push({ date: tx.date, balance: running });
    });
    perAccountPoints[acc.id] = { points, initial: Number(acc.initial_balance) };
  });

  const allDatesSet = new Set();
  liquidAccounts.forEach((acc) => perAccountPoints[acc.id].points.forEach((p) => allDatesSet.add(p.date)));
  const allDates = Array.from(allDatesSet).sort();
  if (!allDates.length) return null;

  const latest = {};
  const pointerIdx = {};
  liquidAccounts.forEach((acc) => {
    latest[acc.id] = perAccountPoints[acc.id].initial;
    pointerIdx[acc.id] = 0;
  });

  const series = { dates: [], total: [], byAccount: {}, accounts: liquidAccounts };
  liquidAccounts.forEach((acc) => { series.byAccount[acc.id] = []; });

  allDates.forEach((date) => {
    liquidAccounts.forEach((acc) => {
      const pts = perAccountPoints[acc.id].points;
      while (pointerIdx[acc.id] < pts.length && pts[pointerIdx[acc.id]].date === date) {
        latest[acc.id] = pts[pointerIdx[acc.id]].balance;
        pointerIdx[acc.id]++;
      }
    });
    let total = 0;
    liquidAccounts.forEach((acc) => {
      total += latest[acc.id];
      series.byAccount[acc.id].push(latest[acc.id]);
    });
    series.dates.push(date);
    series.total.push(total);
  });

  return series;
}

// Баланс одного текущего/наличного счёта во времени.
function computeSingleAccountSeries(account) {
  const txs = state.transactions
    .filter((tx) => tx.account_id === account.id)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  let running = Number(account.initial_balance);
  const dates = [];
  const values = [];
  txs.forEach((tx) => {
    running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
    dates.push(tx.date);
    values.push(running);
  });
  return { dates, values };
}

function renderLiquidLineChart(rootId) {
  const series = computeLiquidSeries();
  if (!series) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(series.dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const dates = series.dates.slice(range.start, range.end + 1);
  const colors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
  const lines = [{ label: t('analytics_total_line_label'), values: series.total.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 }];
  series.accounts.forEach((acc, i) => {
    const label = acc.type === 'cash' ? t('overview_cash_label') : ((state.members.find((m) => m.id === acc.member_id) || {}).name || acc.name);
    lines.push({ label, values: series.byAccount[acc.id].slice(range.start, range.end + 1), color: colors[i % colors.length], width: 2 });
  });

  drawLineChart(rootId, dates, lines);
}

function renderAccountBalanceChart(rootId, account) {
  const { dates, values } = computeSingleAccountSeries(account);
  if (dates.length < 2) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  drawLineChart(rootId, dates.slice(range.start, range.end + 1), [
    { label: t('chart_balance_title'), values: values.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 },
  ]);
}

function renderCheckpointBalanceChart(rootId, account) {
  const cps = checkpointsSorted(account.id, 'asc');
  const dates = cps.map((c) => c.date);
  const values = cps.map((c) => Number(c.balance));
  if (dates.length < 2) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  drawLineChart(rootId, dates.slice(range.start, range.end + 1), [
    { label: t('chart_balance_title'), values: values.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 },
  ]);
}

// Универсальная отрисовка линейного графика: dates — общая ось X,
// lines — массив {label, values, color, width}, значения выровнены по dates.
function drawLineChart(rootId, dates, lines) {
  const root = document.getElementById(rootId);
  if (!dates || dates.length < 2) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const width = 640;
  const height = 260;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = lines.flatMap((l) => l.values);
  const minV = Math.min(0, ...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;

  const xAt = (i) => padL + (i / (dates.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - ((v - minV) / range) * plotH;

  const pathFor = (values) => values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');

  const steps = 4;
  const gridLines = [];
  for (let s = 0; s <= steps; s++) {
    const v = minV + (range * s) / steps;
    gridLines.push({ y: yAt(v), v });
  }

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('chart_balance_title')}">
      ${gridLines.map((g) => `
        <line x1="${padL}" y1="${g.y.toFixed(1)}" x2="${width - padR}" y2="${g.y.toFixed(1)}" stroke="var(--chart-grid)" stroke-width="1" />
        <text x="${padL - 8}" y="${(g.y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--chart-ink-muted)" class="money-value">${formatMoney(g.v)}</text>
      `).join('')}
      <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" />
      <text x="${padL}" y="${height - 8}" font-size="10" fill="var(--chart-ink-muted)" text-anchor="start">${formatDate(dates[0])}</text>
      <text x="${width - padR}" y="${height - 8}" font-size="10" fill="var(--chart-ink-muted)" text-anchor="end">${formatDate(dates[dates.length - 1])}</text>
      ${lines.map((line) => `<path d="${pathFor(line.values)}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round" />`).join('')}
      <line id="${rootId}-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" style="display:none;" />
      <rect id="${rootId}-hover-rect" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" />
    </svg>
  `;

  const legend = lines.length > 1 ? `
    <div class="chart-legend">
      ${lines.map((l) => `<div class="legend-item"><span class="legend-dot" style="background:${l.color}"></span>${escapeHtml(l.label)}</div>`).join('')}
    </div>
  ` : '';

  root.innerHTML = `<div class="chart-svg-wrap">${svg}<div class="chart-tooltip" id="${rootId}-tooltip"></div></div>${legend}`;

  const svgEl = root.querySelector('svg');
  const hoverRect = document.getElementById(`${rootId}-hover-rect`);
  const crosshair = document.getElementById(`${rootId}-crosshair`);
  const tooltip = document.getElementById(`${rootId}-tooltip`);

  hoverRect.addEventListener('mousemove', (e) => {
    const bounds = svgEl.getBoundingClientRect();
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    const localX = (e.clientX - bounds.left) * scaleX;
    let idx = Math.round(((localX - padL) / plotW) * (dates.length - 1));
    idx = Math.max(0, Math.min(dates.length - 1, idx));
    const cx = xAt(idx);
    crosshair.setAttribute('x1', cx);
    crosshair.setAttribute('x2', cx);
    crosshair.style.display = 'block';

    tooltip.style.display = 'block';
    tooltip.style.left = (cx / scaleX) + 'px';
    tooltip.style.top = (yAt(lines[0].values[idx]) / scaleY) + 'px';
    tooltip.innerHTML = `<strong>${formatDate(dates[idx])}</strong><br>` +
      lines.map((l) => `<span style="color:${l.color}">●</span> ${escapeHtml(l.label)}: <span class="money-value">${formatMoney(l.values[idx])}</span>`).join('<br>');
  });
  hoverRect.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function drawRadialGauge(rootId, { fraction, centerHtml, label, color = 'var(--accent)' }) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const clamped = Math.max(0, Math.min(1, fraction || 0));
  const size = 220;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped);

  root.innerHTML = `
    <div class="gauge-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${strokeWidth}" />
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
      </svg>
      <div class="gauge-center">
        <div class="gauge-value">${centerHtml}</div>
        ${label ? `<div class="gauge-label">${escapeHtml(label)}</div>` : ''}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------

// Скрипт подключён в самом низу страницы, так что все элементы уже
// существуют — можно сразу вешать обработчики и грузить данные,
// не дожидаясь DOMContentLoaded (к этому моменту он мог уже случиться).
setLang(getLang());
setTheme(getTheme());
applyStaticText();
document.getElementById('btn-privacy').addEventListener('click', togglePrivacy);
document.getElementById('btn-theme').addEventListener('click', cycleTheme);
document.getElementById('btn-lang').addEventListener('click', openLanguageModal);
loadAll();

// Регистрируем service worker, чтобы приложение можно было "установить"
// на телефон (иконка на рабочем столе) — это и есть Android-версия.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch((e) => console.error('SW error:', e));
}
