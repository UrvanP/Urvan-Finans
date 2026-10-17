// Вкладка члена семьи: подвкладки "Банк счёт" / копилки.
import { state, currentAccountOf, savingsAccountsOf, accountBalance, checkpointsSorted, displayMemberName } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, formatMoney, formatDate } from '../utils.js';
import { renderPeriodControl, attachPeriodControl, renderAccountBalanceChart, drawPieChart, renderExpenseTable, renderCheckpointBalanceChart } from '../charts.js';
import { renderTxSection, attachTxListEvents, renderDataRow } from './transactions.js';
import { openTransactionModal, openCheckpointModal, openNewSavingsModal, openRenameSavingsModal } from './modalForms.js';
import { confirmDialog, alertDialog } from '../modal.js';
import { icon } from '../icons.js';
import { refreshApp, renderCurrentTab } from '../tabs.js';
import { Api } from '../api.js';

export const memberSubTab = {};

export function renderMemberTab(memberId) {
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
      ${savings.map((s) => `<button class="subtab-btn ${selected === s.id ? 'active' : ''}" data-subtab="${s.id}">${s.icon ? escapeHtml(s.icon) + ' ' : ''}${escapeHtml(s.name)}</button>`).join('')}
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
      <div class="label">${t('member_current_prefix')}${escapeHtml(displayMemberName(member.name))}</div>
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
          <div class="label">${account.icon ? `<span class="item-icon">${escapeHtml(account.icon)}</span>` : ''}${escapeHtml(account.name)}</div>
          <div class="amount money-value">${formatMoney(balance)}</div>
          <div class="savings-delta">${deltaHtml}</div>
        </div>
        <div class="tx-actions">
          <button class="icon-btn" id="btn-rename-savings" title="${t('edit_title')}">${icon('pencil', { size: 17 })}</button>
          <button class="icon-btn" id="btn-delete-savings" title="${t('delete_title')}">${icon('trash', { size: 17 })}</button>
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
    return renderDataRow({
      id: c.id,
      idAttr: 'cp-id',
      infoHtml: `
        <span class="tx-category money-value">${formatMoney(c.balance)}</span>
        <span class="tx-meta">${formatDate(c.date)}${c.comment ? ' · ' + escapeHtml(c.comment) : ''}</span>`,
      amountHtml: deltaHtml,
      editClass: 'cp-edit',
      deleteClass: 'cp-delete',
    });
  }).join('');
}

export function attachMemberEvents(memberId) {
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
  document.getElementById('btn-delete-savings').addEventListener('click', async (e) => {
    if (!(await confirmDialog(t('confirm_delete_savings')))) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await Api.deleteAccount(savAccount.id);
      memberSubTab[memberId] = 'current';
      await refreshApp();
    } catch (err) {
      btn.disabled = false;
      alertDialog(t('err_savings_delete_failed') + err.message);
    }
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
      if (!(await confirmDialog(t('confirm_delete_checkpoint')))) return;
      const btn = row.querySelector('.cp-delete');
      btn.disabled = true;
      try {
        await Api.deleteCheckpoint(cpId);
        await refreshApp();
      } catch (err) {
        btn.disabled = false;
        alertDialog(t('err_checkpoint_delete_failed') + err.message);
      }
    });
  });
}
