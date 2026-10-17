// Список операций: фильтры + сам список (общий для банка и наличности).
import { state } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, formatMoney, formatDate } from '../utils.js';
import { openTransactionModal } from './modalForms.js';
import { confirmDialog, alertDialog } from '../modal.js';
import { icon } from '../icons.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';

const txFilters = {};

function ensureTxFilter(accountId) {
  if (!txFilters[accountId]) txFilters[accountId] = { categoryId: '', dateFrom: '', dateTo: '', search: '' };
  return txFilters[accountId];
}

export function filteredTransactions(accountId) {
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
        ${cats.map((c) => `<option value="${c.id}" ${f.categoryId === c.id ? 'selected' : ''}>${c.icon ? escapeHtml(c.icon) + ' ' : ''}${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <input type="date" class="f-date-from" value="${f.dateFrom}" title="${t('filter_date_from')}" />
      <input type="date" class="f-date-to" value="${f.dateTo}" title="${t('filter_date_to')}" />
      <input type="text" class="f-search" placeholder="${t('filter_search_placeholder')}" value="${escapeHtml(f.search)}" />
      <button type="button" class="btn btn-ghost btn-small f-clear">${t('filter_clear')}</button>
    </div>
  `;
}

export function renderTxSection(accountId) {
  if (!accountId) return `<div class="empty-hint">${t('empty_account_not_found')}</div>`;
  return `${renderFilterBar(accountId)}<div id="tx-list-${accountId}">${renderTxListRows(accountId)}</div>`;
}

// Общая разметка строки "запись + сумма/дельта + правка/удаление" — тот же
// каркас (.tx-card > .tx-info + сумма + .tx-actions) используют и список
// операций здесь, и список чекапов копилки (member.js), различается только
// содержимое info/amount и классы кнопок, чтобы у каждого списка были свои
// обработчики событий.
export function renderDataRow({ id, idAttr, infoHtml, amountHtml, editClass, deleteClass }) {
  return `
    <div class="tx-card" data-${idAttr}="${id}">
      <div class="tx-info">${infoHtml}</div>
      ${amountHtml}
      <div class="tx-actions">
        <button class="icon-btn ${editClass}" title="${t('edit_title')}">${icon('pencil', { size: 17 })}</button>
        <button class="icon-btn ${deleteClass}" title="${t('delete_title')}">${icon('trash', { size: 17 })}</button>
      </div>
    </div>`;
}

function renderTxListRows(accountId) {
  const txs = filteredTransactions(accountId);
  if (txs.length === 0) return `<div class="empty-hint">${t('empty_no_transactions')}</div>`;

  return txs.map((tx) => {
    const cat = state.categories.find((c) => c.id === tx.category_id);
    const catIcon = cat && cat.icon ? escapeHtml(cat.icon) + ' ' : '';
    const catName = cat ? cat.name : t('no_category_label');
    const sign = tx.type === 'income' ? '+' : '−';
    return renderDataRow({
      id: tx.id,
      idAttr: 'tx-id',
      infoHtml: `
        <span class="tx-category">${catIcon}${escapeHtml(catName)}</span>
        <span class="tx-meta">${formatDate(tx.date)}${tx.comment ? ' · ' + escapeHtml(tx.comment) : ''}</span>`,
      amountHtml: `<div class="tx-amount money-value ${tx.type}">${sign} ${formatMoney(tx.amount)}</div>`,
      editClass: 'tx-edit',
      deleteClass: 'tx-delete',
    });
  }).join('');
}

function attachFilterBarEvents(accountId) {
  const bar = document.getElementById(`filter-bar-${accountId}`);
  if (!bar) return;
  const f = ensureTxFilter(accountId);
  bar.querySelector('.f-category').addEventListener('change', (e) => { f.categoryId = e.target.value; renderAfterFilterChange(accountId); });
  bar.querySelector('.f-date-from').addEventListener('change', (e) => { f.dateFrom = e.target.value; renderAfterFilterChange(accountId); });
  bar.querySelector('.f-date-to').addEventListener('change', (e) => { f.dateTo = e.target.value; renderAfterFilterChange(accountId); });
  // "input", а не "change" — результаты фильтруются по мере набора текста,
  // а не только после того, как поле теряет фокус.
  bar.querySelector('.f-search').addEventListener('input', (e) => { f.search = e.target.value; renderAfterFilterChange(accountId); });
  bar.querySelector('.f-clear').addEventListener('click', () => {
    txFilters[accountId] = { categoryId: '', dateFrom: '', dateTo: '', search: '' };
    renderAfterFilterChange(accountId);
  });
}

// Фильтры меняют только список операций — не нужно перерисовывать всю
// вкладку целиком (это сбивало бы фокус с поля поиска при вводе).
function renderAfterFilterChange(accountId) {
  const list = document.getElementById(`tx-list-${accountId}`);
  if (list) list.innerHTML = renderTxListRows(accountId);
  attachTxListEvents(accountId, { skipFilterBar: true });
}

export function attachTxListEvents(accountId, { skipFilterBar = false } = {}) {
  const container = document.getElementById(`tx-list-${accountId}`);
  if (container) {
    container.querySelectorAll('.tx-card').forEach((card) => {
      const txId = card.dataset.txId;
      card.querySelector('.tx-edit').addEventListener('click', () => {
        const tx = state.transactions.find((t) => t.id === txId);
        openTransactionModal({ accountId, transaction: tx });
      });
      card.querySelector('.tx-delete').addEventListener('click', async () => {
        if (!(await confirmDialog(t('confirm_delete_transaction')))) return;
        const btn = card.querySelector('.tx-delete');
        btn.disabled = true;
        try {
          await Api.deleteTransaction(txId);
          await refreshApp();
        } catch (err) {
          btn.disabled = false;
          alertDialog(t('err_tx_delete_failed') + err.message);
        }
      });
    });
  }
  if (!skipFilterBar) attachFilterBarEvents(accountId);
}
