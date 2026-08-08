// Вся логика интерфейса: переключение вкладок, отрисовка данных,
// модальные окна для добавления/редактирования.
// Данные храним в одном объекте state и перечитываем их из Supabase
// после каждого изменения (просто и надёжно для такого размера приложения).

let state = { members: [], categories: [], accounts: [], transactions: [], checkpoints: [] };
let currentTab = 'overview';

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
  document.getElementById('app').innerHTML = `
    <div class="error-banner">
      Нужно указать данные подключения к Supabase.<br>
      Откройте файл <code>js/config.js</code> и впишите туда ваш <b>Project URL</b> и <b>anon public key</b>
      (в Supabase: Project Settings → API), затем обновите страницу.
    </div>`;
}

function showLoadError(err) {
  document.getElementById('app').innerHTML = `
    <div class="error-banner">
      Не удалось загрузить данные из Supabase.<br>
      Проверьте <code>js/config.js</code> и что в Supabase выполнены скрипты <code>sql/schema.sql</code> и <code>sql/migration_2_checkpoints.sql</code>.<br>
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
  nav.appendChild(makeTabButton('overview', 'Общий статус', '<span class="tab-icon">🏠</span>'));
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
  const grandTotal = memberBalances.reduce((s, x) => s + x.balance, 0) + savingsTotal + cashBalance;

  return `
    <div class="summary-grid">
      ${memberBalances.map((x) => `
        <div class="card balance-card">
          <div class="label">${escapeHtml(x.member.name)} — текущий счёт</div>
          <div class="amount">${formatMoney(x.balance)}</div>
        </div>`).join('')}
      <div class="card balance-card">
        <div class="label">Общая наличность</div>
        <div class="amount">${formatMoney(cashBalance)}</div>
      </div>
      <div class="card balance-card total">
        <div class="label">Итого по семье (счета + наличность + копилки)</div>
        <div class="amount">${formatMoney(grandTotal)}</div>
      </div>
    </div>

    <div class="section-title">
      <h2>Операции по общей наличности</h2>
      <button class="btn btn-small" id="btn-add-cash-tx">+ Добавить операцию</button>
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

function renderMemberTab(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return '<div class="empty-hint">Член семьи не найден.</div>';

  const account = currentAccountOf(memberId);
  const savings = savingsAccountsOf(memberId);
  const balance = accountBalance(account);

  return `
    <div class="card balance-card">
      <div class="label">Текущий счёт — ${escapeHtml(member.name)}</div>
      <div class="amount">${formatMoney(balance)}</div>
    </div>

    <div class="section-title">
      <h2>Операции</h2>
      <button class="btn btn-small" id="btn-add-tx">+ Добавить операцию</button>
    </div>
    <div id="member-tx-list">${renderTxList(account ? account.id : null)}</div>

    <div class="section-title">
      <h2>Копилки</h2>
      <button class="btn btn-small" id="btn-add-savings">+ Добавить копилку</button>
    </div>
    <div class="savings-grid" id="savings-list">
      ${savings.length ? savings.map((s) => renderSavingsCard(s)).join('') : '<div class="empty-hint">Пока нет копилок.</div>'}
    </div>
  `;
}

function renderSavingsCard(account) {
  const cps = checkpointsSorted(account.id, 'desc');
  const balance = accountBalance(account);
  let deltaHtml = '<span class="tx-meta">Пока нет чекапов</span>';
  if (cps.length >= 2) {
    const delta = Number(cps[0].balance) - Number(cps[1].balance);
    const cls = delta >= 0 ? 'income' : 'expense';
    const sign = delta >= 0 ? '+' : '−';
    deltaHtml = `<span class="tx-amount ${cls}">${sign} ${formatMoney(Math.abs(delta))}</span> <span class="tx-meta">с ${formatDate(cps[1].date)}</span>`;
  } else if (cps.length === 1) {
    deltaHtml = `<span class="tx-meta">чекап от ${formatDate(cps[0].date)}</span>`;
  }
  return `
    <div class="card savings-card" data-account-id="${account.id}">
      <div class="savings-card-main">
        <div class="label">${escapeHtml(account.name)}</div>
        <div class="amount">${formatMoney(balance)}</div>
        <div class="savings-delta">${deltaHtml}</div>
      </div>
      <div class="tx-actions">
        <button class="icon-btn sav-rename" title="Переименовать">✏️</button>
        <button class="icon-btn sav-delete" title="Удалить">🗑️</button>
      </div>
    </div>`;
}

function attachMemberEvents(memberId) {
  const account = currentAccountOf(memberId);
  if (account) {
    document.getElementById('btn-add-tx').addEventListener('click', () => openTransactionModal({ accountId: account.id }));
    attachTxListEvents(document.getElementById('member-tx-list'), account.id);
  }

  document.getElementById('btn-add-savings').addEventListener('click', () => openNewSavingsModal({ memberId }));

  document.querySelectorAll('#savings-list .savings-card').forEach((card) => {
    const accId = card.dataset.accountId;
    card.querySelector('.savings-card-main').addEventListener('click', () => openSavingsHistoryModal(accId));
    card.querySelector('.sav-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameSavingsModal(accId);
    });
    card.querySelector('.sav-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Удалить копилку? Вся история чекапов тоже удалится.')) return;
      await Api.deleteAccount(accId);
      await loadAll();
    });
  });
}

// ---------------------------------------------------------------
// Список операций (общий для вкладки члена семьи и общей наличности)
// ---------------------------------------------------------------

function renderTxList(accountId) {
  if (!accountId) return '<div class="empty-hint">Счёт не найден.</div>';
  const txs = state.transactions
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  if (txs.length === 0) return '<div class="empty-hint">Пока нет операций.</div>';

  return txs.map((t) => {
    const cat = state.categories.find((c) => c.id === t.category_id);
    const catName = cat ? cat.name : '(без категории)';
    const sign = t.type === 'income' ? '+' : '−';
    return `
      <div class="tx-card" data-tx-id="${t.id}">
        <div class="tx-info">
          <span class="tx-category">${escapeHtml(catName)}</span>
          <span class="tx-meta">${formatDate(t.date)}${t.comment ? ' · ' + escapeHtml(t.comment) : ''}</span>
        </div>
        <div class="tx-amount ${t.type}">${sign} ${formatMoney(t.amount)}</div>
        <div class="tx-actions">
          <button class="icon-btn tx-edit" title="Редактировать">✏️</button>
          <button class="icon-btn tx-delete" title="Удалить">🗑️</button>
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
      if (!confirm('Удалить операцию?')) return;
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

  const categoryOptions = (t) => {
    const options = state.categories
      .filter((c) => c.type === t)
      .map((c) => `<option value="${c.id}" ${transaction && transaction.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
      .join('');
    return `<option value="">— без категории —</option>${options}`;
  };

  openModal(`
    <h3>${isEdit ? 'Редактировать операцию' : 'Новая операция'}</h3>
    <div class="form-row">
      <label>Тип операции</label>
      <div class="type-toggle" id="tx-type-toggle">
        <button type="button" data-type="expense" class="${type === 'expense' ? 'active' : ''}">Расход</button>
        <button type="button" data-type="income" class="${type === 'income' ? 'active' : ''}">Доход</button>
      </div>
    </div>
    <div class="form-row">
      <label>Категория</label>
      <select id="tx-category">${categoryOptions(type)}</select>
    </div>
    <div class="form-row">
      <label>Сумма, ₪</label>
      <input type="number" id="tx-amount" min="0" step="0.01" value="${transaction ? transaction.amount : ''}" />
    </div>
    <div class="form-row">
      <label>Дата</label>
      <input type="date" id="tx-date" value="${transaction ? transaction.date : todayStr()}" />
    </div>
    <div class="form-row">
      <label>Комментарий</label>
      <input type="text" id="tx-comment" value="${transaction && transaction.comment ? escapeHtml(transaction.comment) : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="tx-cancel">Отмена</button>
      <button class="btn" id="tx-save">Сохранить</button>
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

    if (!amount || amount <= 0) { alert('Введите сумму больше нуля.'); return; }
    if (!date) { alert('Укажите дату.'); return; }

    try {
      if (isEdit) {
        await Api.updateTransaction(transaction.id, { type, category_id, amount, date, comment });
      } else {
        await Api.addTransaction({ account_id: accountId, category_id, type, amount, date, comment });
      }
      closeModal();
      await loadAll();
    } catch (err) {
      alert('Не удалось сохранить операцию: ' + err.message);
    }
  });
}

// ---- Копилки: создание, переименование, история чекапов ----

function openNewSavingsModal({ memberId }) {
  openModal(`
    <h3>Новая копилка</h3>
    <div class="form-row">
      <label>Название</label>
      <input type="text" id="new-sav-name" placeholder="Например, Пенсия" />
    </div>
    <div class="form-row">
      <label>Текущая сумма, ₪</label>
      <input type="number" id="new-sav-balance" step="0.01" />
    </div>
    <div class="form-row">
      <label>Дата</label>
      <input type="date" id="new-sav-date" value="${todayStr()}" />
    </div>
    <div class="form-row">
      <label>Комментарий (необязательно)</label>
      <input type="text" id="new-sav-comment" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="new-sav-cancel">Отмена</button>
      <button class="btn" id="new-sav-save">Создать</button>
    </div>
  `);

  document.getElementById('new-sav-cancel').addEventListener('click', closeModal);
  document.getElementById('new-sav-save').addEventListener('click', async () => {
    const name = document.getElementById('new-sav-name').value.trim();
    const balance = parseFloat(document.getElementById('new-sav-balance').value);
    const date = document.getElementById('new-sav-date').value;
    const comment = document.getElementById('new-sav-comment').value.trim();

    if (!name) { alert('Введите название копилки.'); return; }
    if (isNaN(balance)) { alert('Введите текущую сумму.'); return; }
    if (!date) { alert('Укажите дату.'); return; }

    try {
      const account = await Api.addAccount({ member_id: memberId, type: 'savings', name, initial_balance: 0 });
      await Api.addCheckpoint({ account_id: account.id, date, balance, comment });
      closeModal();
      await loadAll();
    } catch (err) {
      alert('Не удалось создать копилку: ' + err.message);
    }
  });
}

function openRenameSavingsModal(accountId) {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return;
  openModal(`
    <h3>Переименовать копилку</h3>
    <div class="form-row">
      <label>Название</label>
      <input type="text" id="rename-input" value="${escapeHtml(account.name)}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="rename-cancel">Отмена</button>
      <button class="btn" id="rename-save">Сохранить</button>
    </div>
  `);

  document.getElementById('rename-cancel').addEventListener('click', closeModal);
  document.getElementById('rename-save').addEventListener('click', async () => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name) { alert('Название не может быть пустым.'); return; }
    try {
      await Api.updateAccount(accountId, { name });
      closeModal();
      await loadAll();
    } catch (err) {
      alert('Не удалось переименовать копилку: ' + err.message);
    }
  });
}

// История чекапов конкретной копилки: список + добавление/редактирование/удаление
function openSavingsHistoryModal(accountId) {
  function render() {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) { closeModal(); return; }
    const cps = checkpointsSorted(accountId, 'desc');

    const rowsHtml = cps.length ? cps.map((c, idx) => {
      let deltaHtml = '<span class="tx-meta">начало отсчёта</span>';
      if (idx < cps.length - 1) {
        const delta = Number(c.balance) - Number(cps[idx + 1].balance);
        const cls = delta >= 0 ? 'income' : 'expense';
        const sign = delta >= 0 ? '+' : '−';
        deltaHtml = `<span class="tx-amount ${cls}">${sign} ${formatMoney(Math.abs(delta))}</span>`;
      }
      return `
        <div class="tx-card" data-cp-id="${c.id}">
          <div class="tx-info">
            <span class="tx-category">${formatMoney(c.balance)}</span>
            <span class="tx-meta">${formatDate(c.date)}${c.comment ? ' · ' + escapeHtml(c.comment) : ''}</span>
          </div>
          ${deltaHtml}
          <div class="tx-actions">
            <button class="icon-btn cp-edit" title="Редактировать">✏️</button>
            <button class="icon-btn cp-delete" title="Удалить">🗑️</button>
          </div>
        </div>`;
    }).join('') : '<div class="empty-hint">Пока нет чекапов.</div>';

    openModal(`
      <h3>${escapeHtml(account.name)}</h3>
      <div class="modal-actions" style="margin-top:0;margin-bottom:16px;">
        <button class="btn btn-ghost btn-small" id="cp-close">Закрыть</button>
        <button class="btn btn-small" id="cp-add">+ Добавить чекап</button>
      </div>
      <div id="cp-list">${rowsHtml}</div>
    `);

    document.getElementById('cp-close').addEventListener('click', closeModal);
    document.getElementById('cp-add').addEventListener('click', () => openCheckpointModal({ accountId, onDone: render }));

    document.querySelectorAll('#cp-list .tx-card').forEach((row) => {
      const cpId = row.dataset.cpId;
      row.querySelector('.cp-edit').addEventListener('click', () => {
        const cp = state.checkpoints.find((x) => x.id === cpId);
        openCheckpointModal({ accountId, checkpoint: cp, onDone: render });
      });
      row.querySelector('.cp-delete').addEventListener('click', async () => {
        if (!confirm('Удалить этот чекап?')) return;
        await Api.deleteCheckpoint(cpId);
        await loadAll();
        render();
      });
    });
  }

  render();
}

function openCheckpointModal({ accountId, checkpoint, onDone }) {
  const isEdit = !!checkpoint;
  openModal(`
    <h3>${isEdit ? 'Редактировать чекап' : 'Новый чекап'}</h3>
    <div class="form-row">
      <label>Дата</label>
      <input type="date" id="cp-date" value="${checkpoint ? checkpoint.date : todayStr()}" />
    </div>
    <div class="form-row">
      <label>Баланс, ₪</label>
      <input type="number" id="cp-balance" step="0.01" value="${checkpoint ? checkpoint.balance : ''}" />
    </div>
    <div class="form-row">
      <label>Комментарий</label>
      <input type="text" id="cp-comment" value="${checkpoint && checkpoint.comment ? escapeHtml(checkpoint.comment) : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cp-cancel">Отмена</button>
      <button class="btn" id="cp-save">Сохранить</button>
    </div>
  `);

  document.getElementById('cp-cancel').addEventListener('click', () => {
    closeModal();
    if (onDone) onDone();
  });

  document.getElementById('cp-save').addEventListener('click', async () => {
    const date = document.getElementById('cp-date').value;
    const balance = parseFloat(document.getElementById('cp-balance').value);
    const comment = document.getElementById('cp-comment').value.trim();

    if (!date) { alert('Укажите дату.'); return; }
    if (isNaN(balance)) { alert('Введите сумму.'); return; }

    try {
      if (isEdit) {
        await Api.updateCheckpoint(checkpoint.id, { date, balance, comment });
      } else {
        await Api.addCheckpoint({ account_id: accountId, date, balance, comment });
      }
      await loadAll();
      if (onDone) onDone(); else closeModal();
    } catch (err) {
      alert('Не удалось сохранить чекап: ' + err.message);
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
        <button class="icon-btn cat-save" title="Сохранить имя">💾</button>
        <button class="icon-btn cat-delete" title="Удалить">🗑️</button>
      </div>`).join('') || '<div class="empty-hint">Пока нет категорий.</div>';

    openModal(`
      <h3>Категории</h3>
      <div class="category-group-title">Доходы</div>
      <div id="cat-income-list">${rowsHtml(income)}</div>
      <div class="category-group-title">Расходы</div>
      <div id="cat-expense-list">${rowsHtml(expense)}</div>

      <div class="section-title"><h2>Добавить категорию</h2></div>
      <div class="form-row">
        <label>Название</label>
        <input type="text" id="new-cat-name" />
      </div>
      <div class="form-row">
        <label>Тип</label>
        <div class="type-toggle" id="new-cat-type-toggle">
          <button type="button" data-type="expense" class="active">Расход</button>
          <button type="button" data-type="income">Доход</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cat-close">Закрыть</button>
        <button class="btn" id="cat-add">Добавить</button>
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
      if (!name) { alert('Введите название категории.'); return; }
      try {
        await Api.addCategory(name, newType);
        await loadAll();
        render();
      } catch (err) {
        alert('Не удалось добавить категорию: ' + err.message);
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
        if (!name) { alert('Название не может быть пустым.'); return; }
        try {
          await Api.renameCategory(id, name);
          await loadAll();
        } catch (err) {
          alert('Не удалось переименовать категорию: ' + err.message);
        }
      });
      row.querySelector('.cat-delete').addEventListener('click', async () => {
        if (!confirm('Удалить категорию? У операций с этой категорией она станет пустой.')) return;
        try {
          await Api.deleteCategory(id);
          await loadAll();
          render();
        } catch (err) {
          alert('Не удалось удалить категорию: ' + err.message);
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
document.getElementById('btn-categories').addEventListener('click', openCategoriesModal);
loadAll();

// Регистрируем service worker, чтобы приложение можно было "установить"
// на телефон (иконка на рабочем столе) — это и есть Android-версия.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch((e) => console.error('SW error:', e));
}
