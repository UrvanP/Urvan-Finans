// Вся логика интерфейса: переключение вкладок, отрисовка данных,
// модальные окна для добавления/редактирования.
// Данные храним в одном объекте state и перечитываем их из Supabase
// после каждого изменения (просто и надёжно для такого размера приложения).

let state = { members: [], categories: [], accounts: [], transactions: [], checkpoints: [] };
let currentTab = 'overview';
let privacyMode = false;

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
// Язык интерфейса
// ---------------------------------------------------------------

function applyStaticText() {
  document.title = t('app_title');
  document.getElementById('app-title-text').textContent = t('app_title');
  document.getElementById('btn-categories').textContent = t('categories_btn');
  document.getElementById('btn-lang').title = t('lang_btn_title');
  applyPrivacyButton();
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

const AVATAR_COLORS = ['#3b6ef6', '#1a9d5c', '#d64545', '#b3762c', '#7c5cd6', '#0e9aa7'];

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
  } else if (currentTab.startsWith('member:')) {
    const memberId = currentTab.slice('member:'.length);
    app.innerHTML = renderMemberTab(memberId);
    attachMemberEvents(memberId);
  }
}

// ---------------------------------------------------------------
// Вкладка "Общий статус"
// ---------------------------------------------------------------

function renderOverview() {
  const cash = cashAccount();
  const memberBalances = state.members.map((m) => ({
    member: m,
    balance: accountBalance(currentAccountOf(m.id)),
  }));
  const savingsTotal = state.accounts
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + accountBalance(a), 0);
  const cashBalance = accountBalance(cash);
  const liquidTotal = memberBalances.reduce((s, x) => s + x.balance, 0) + cashBalance;

  return `
    <div class="summary-grid">
      ${memberBalances.map((x) => `
        <div class="card balance-card">
          <div class="label">${escapeHtml(x.member.name)}${t('overview_current_suffix')}</div>
          <div class="amount money-value">${formatMoney(x.balance)}</div>
        </div>`).join('')}
      <div class="card balance-card">
        <div class="label">${t('overview_cash_label')}</div>
        <div class="amount money-value">${formatMoney(cashBalance)}</div>
      </div>
      <div class="card balance-card total">
        <div class="label">${t('overview_liquid_total')}</div>
        <div class="amount money-value">${formatMoney(liquidTotal)}</div>
      </div>
      <div class="card balance-card">
        <div class="label">${t('overview_savings_total')}</div>
        <div class="amount money-value">${formatMoney(savingsTotal)}</div>
      </div>
    </div>

    <div class="section-title">
      <h2>${t('overview_cash_ops_title')}</h2>
      <button class="btn btn-small" id="btn-add-cash-tx">${t('add_transaction_btn')}</button>
    </div>
    <div id="cash-tx-list">${renderTxList(cash ? cash.id : null)}</div>
  `;
}

function attachOverviewEvents() {
  const cash = cashAccount();
  if (!cash) return;
  document.getElementById('btn-add-cash-tx').addEventListener('click', () => openTransactionModal({ accountId: cash.id }));
  attachTxListEvents(document.getElementById('cash-tx-list'), cash.id);
}

// ---------------------------------------------------------------
// Вкладка члена семьи
// ---------------------------------------------------------------

// memberId -> 'current' или id выбранной копилки. Хранит, какая
// подвкладка сейчас открыта у каждого члена семьи.
let memberSubTab = {};

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
      ${savings.map((s) => `<button class="subtab-btn ${selected === s.id ? 'active' : ''}" data-subtab="${s.id}">${escapeHtml(s.name)}</button>`).join('')}
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

    <div class="section-title">
      <h2>${t('section_operations')}</h2>
      <button class="btn btn-small" id="btn-add-tx">${t('add_transaction_btn')}</button>
    </div>
    <div id="member-tx-list">${renderTxList(account ? account.id : null)}</div>
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
          <div class="label">${escapeHtml(account.name)}</div>
          <div class="amount money-value">${formatMoney(balance)}</div>
          <div class="savings-delta">${deltaHtml}</div>
        </div>
        <div class="tx-actions">
          <button class="icon-btn" id="btn-rename-savings" title="${t('edit_title')}">✏️</button>
          <button class="icon-btn" id="btn-delete-savings" title="${t('delete_title')}">🗑️</button>
        </div>
      </div>
    </div>

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
      document.getElementById('btn-add-tx').addEventListener('click', () => openTransactionModal({ accountId: account.id }));
      attachTxListEvents(document.getElementById('member-tx-list'), account.id);
    }
    return;
  }

  const savAccount = savings.find((s) => s.id === selected);
  if (!savAccount) return;

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
    row.querySelector('.cp-delete').addEventListener('click', async () => {
      if (!confirm(t('confirm_delete_checkpoint'))) return;
      await Api.deleteCheckpoint(cpId);
      await loadAll();
    });
  });
}

// ---------------------------------------------------------------
// Список операций (общий для вкладки члена семьи и общей наличности)
// ---------------------------------------------------------------

function renderTxList(accountId) {
  if (!accountId) return `<div class="empty-hint">${t('empty_account_not_found')}</div>`;
  const txs = state.transactions
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  if (txs.length === 0) return `<div class="empty-hint">${t('empty_no_transactions')}</div>`;

  return txs.map((tx) => {
    const cat = state.categories.find((c) => c.id === tx.category_id);
    const catName = cat ? cat.name : t('no_category_label');
    const sign = tx.type === 'income' ? '+' : '−';
    return `
      <div class="tx-card" data-tx-id="${tx.id}">
        <div class="tx-info">
          <span class="tx-category">${escapeHtml(catName)}</span>
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

function attachTxListEvents(container, accountId) {
  if (!container) return;
  container.querySelectorAll('.tx-card').forEach((card) => {
    const txId = card.dataset.txId;
    card.querySelector('.tx-edit').addEventListener('click', () => {
      const tx = state.transactions.find((t) => t.id === txId);
      openTransactionModal({ accountId, transaction: tx });
    });
    card.querySelector('.tx-delete').addEventListener('click', async () => {
      if (!confirm(t('confirm_delete_transaction'))) return;
      await Api.deleteTransaction(txId);
      await loadAll();
    });
  });
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

// ---- Модалка операции (доход/расход) ----

function openTransactionModal({ accountId, transaction }) {
  const isEdit = !!transaction;
  let type = transaction ? transaction.type : 'expense';

  const categoryOptions = (ty) => {
    const options = state.categories
      .filter((c) => c.type === ty)
      .map((c) => `<option value="${c.id}" ${transaction && transaction.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
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
    <div class="modal-actions">
      <button class="btn btn-ghost" id="new-sav-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="new-sav-save">${t('btn_create')}</button>
    </div>
  `);

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
      const account = await Api.addAccount({ member_id: memberId, type: 'savings', name, initial_balance: 0 });
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
    <div class="modal-actions">
      <button class="btn btn-ghost" id="rename-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="rename-save">${t('btn_save')}</button>
    </div>
  `);

  document.getElementById('rename-cancel').addEventListener('click', closeModal);
  document.getElementById('rename-save').addEventListener('click', async () => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name) { alert(t('err_name_empty')); return; }
    try {
      await Api.updateAccount(accountId, { name });
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

// ---- Модалка управления категориями ----

function openCategoriesModal() {
  function render() {
    const income = state.categories.filter((c) => c.type === 'income');
    const expense = state.categories.filter((c) => c.type === 'expense');
    const rowsHtml = (list) => list.map((c) => `
      <div class="category-row" data-id="${c.id}">
        <input type="text" value="${escapeHtml(c.name)}" class="cat-name-input" />
        <button class="icon-btn cat-save" title="${t('save_name_title')}">💾</button>
        <button class="icon-btn cat-delete" title="${t('delete_title')}">🗑️</button>
      </div>`).join('') || `<div class="empty-hint">${t('empty_no_categories')}</div>`;

    openModal(`
      <h3>${t('categories_modal_title')}</h3>
      <div class="category-group-title">${t('categories_income_group')}</div>
      <div id="cat-income-list">${rowsHtml(income)}</div>
      <div class="category-group-title">${t('categories_expense_group')}</div>
      <div id="cat-expense-list">${rowsHtml(expense)}</div>

      <div class="section-title"><h2>${t('add_category_title')}</h2></div>
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
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cat-close">${t('btn_close')}</button>
        <button class="btn" id="cat-add">${t('btn_add')}</button>
      </div>
    `);

    let newType = 'expense';
    const typeToggle = document.getElementById('new-cat-type-toggle');
    typeToggle.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        newType = btn.dataset.type;
        typeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('cat-close').addEventListener('click', closeModal);

    document.getElementById('cat-add').addEventListener('click', async () => {
      const name = document.getElementById('new-cat-name').value.trim();
      if (!name) { alert(t('err_category_name_required')); return; }
      try {
        await Api.addCategory(name, newType);
        await loadAll();
        render();
      } catch (err) {
        alert(t('err_category_add_failed') + err.message);
      }
    });

    attachCatRowEvents('cat-income-list');
    attachCatRowEvents('cat-expense-list');
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
          await Api.renameCategory(id, name);
          await loadAll();
        } catch (err) {
          alert(t('err_category_rename_failed') + err.message);
        }
      });
      row.querySelector('.cat-delete').addEventListener('click', async () => {
        if (!confirm(t('confirm_delete_category'))) return;
        try {
          await Api.deleteCategory(id);
          await loadAll();
          render();
        } catch (err) {
          alert(t('err_category_delete_failed') + err.message);
        }
      });
    });
  }

  render();
}

// ---------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------

// Скрипт подключён в самом низу страницы, так что все элементы уже
// существуют — можно сразу вешать обработчики и грузить данные,
// не дожидаясь DOMContentLoaded (к этому моменту он мог уже случиться).
setLang(getLang());
applyStaticText();
document.getElementById('btn-categories').addEventListener('click', openCategoriesModal);
document.getElementById('btn-privacy').addEventListener('click', togglePrivacy);
document.getElementById('btn-lang').addEventListener('click', openLanguageModal);
loadAll();

// Регистрируем service worker, чтобы приложение можно было "установить"
// на телефон (иконка на рабочем столе) — это и есть Android-версия.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch((e) => console.error('SW error:', e));
}
