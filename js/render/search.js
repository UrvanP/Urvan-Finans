// Глобальный поиск по операциям во всех счетах сразу (в отличие от фильтра
// на вкладке счёта, который всегда ограничен одним счётом). Открывается из
// иконки в шапке, ищет по тексту комментария и названию категории, клик по
// результату сразу открывает операцию на редактирование.
import { state, accountLabel } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, formatMoney, formatDate } from '../utils.js';
import { openModal, closeModal } from '../modal.js';
import { openTransactionModal } from './modalForms.js';

const MAX_RESULTS = 100;

function searchTransactions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return state.transactions
    .filter((tx) => {
      const cat = state.categories.find((c) => c.id === tx.category_id);
      const catName = cat ? cat.name.toLowerCase() : '';
      const comment = (tx.comment || '').toLowerCase();
      return comment.includes(q) || catName.includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_RESULTS);
}

function renderResults(results) {
  if (!results.length) return `<div class="empty-hint">${t('global_search_empty')}</div>`;
  return results.map((tx) => {
    const cat = state.categories.find((c) => c.id === tx.category_id);
    const catIcon = cat && cat.icon ? escapeHtml(cat.icon) + ' ' : '';
    const catName = cat ? cat.name : t('no_category_label');
    const sign = tx.type === 'income' ? '+' : '−';
    return `
      <div class="tx-card search-result" data-tx-id="${tx.id}" data-account-id="${tx.account_id}">
        <div class="tx-info">
          <span class="tx-category">${catIcon}${escapeHtml(catName)}</span>
          <span class="tx-meta">${escapeHtml(accountLabel(tx.account_id))} · ${formatDate(tx.date)}${tx.comment ? ' · ' + escapeHtml(tx.comment) : ''}</span>
        </div>
        <div class="tx-amount money-value ${tx.type}">${sign} ${formatMoney(tx.amount)}</div>
      </div>`;
  }).join('');
}

export function openGlobalSearchModal() {
  openModal(`
    <h3>${t('global_search_title')}</h3>
    <div class="form-row">
      <input type="text" id="global-search-input" placeholder="${t('global_search_placeholder')}" />
    </div>
    <div class="global-search-results" id="global-search-results">
      <div class="empty-hint">${t('global_search_hint')}</div>
    </div>
  `);

  const input = document.getElementById('global-search-input');
  const resultsEl = document.getElementById('global-search-results');

  function attachResultClicks() {
    resultsEl.querySelectorAll('.search-result').forEach((row) => {
      row.addEventListener('click', () => {
        const tx = state.transactions.find((t) => t.id === row.dataset.txId);
        const accountId = row.dataset.accountId;
        closeModal();
        openTransactionModal({ accountId, transaction: tx });
      });
    });
  }

  input.addEventListener('input', () => {
    if (!input.value.trim()) {
      resultsEl.innerHTML = `<div class="empty-hint">${t('global_search_hint')}</div>`;
      return;
    }
    resultsEl.innerHTML = renderResults(searchTransactions(input.value));
    attachResultClicks();
  });
}
