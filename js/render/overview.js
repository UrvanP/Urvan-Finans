// Вкладка "Общий статус": гейдж ликвидных средств, карточки участников,
// графики и операции по общей наличности.
import { state, cashAccount, currentAccountOf, accountBalance, avatarColor } from '../state.js';
import { t } from '../i18n.js';
import { formatMoney, escapeHtml, animateCountUp } from '../utils.js';
import { renderPeriodControl, attachPeriodControl, renderNetWorthLineChart, drawPieChart, renderExpenseTable, drawRadialGauge, computeNetWorthMonthlyChange } from '../charts.js';
import { renderTxSection, attachTxListEvents } from './transactions.js';
import { openTransactionModal } from './modalForms.js';
import { icon } from '../icons.js';

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
      <button class="summary-banner-close" id="summary-banner-close" title="${t('btn_close')}">${icon('x', { size: 16 })}</button>
    </div>
  `;
}

export function renderOverview() {
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

  return `
    ${renderMonthlySummaryBanner()}
    <div class="card gauge-card">
      <div id="overview-total-gauge"></div>
      <div id="overview-gauge-change"></div>
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

export function attachOverviewEvents() {
  const closeBtn = document.getElementById('summary-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const banner = document.getElementById('month-summary-banner');
      localStorage.setItem('summaryDismissed', banner.dataset.month);
      banner.remove();
    });
  }

  attachPeriodControl();
  renderNetWorthLineChart('overview-line-chart');
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
    centerHtml: `<span class="money-value" id="overview-total-gauge-value">${formatMoney(0)}</span>`,
    label: t('overview_liquid_total'),
  });
  animateCountUp(document.getElementById('overview-total-gauge-value'), liquidTotal, formatMoney);

  const change = computeNetWorthMonthlyChange();
  const changeEl = document.getElementById('overview-gauge-change');
  if (change) {
    changeEl.innerHTML = `
      <span class="change-badge ${change.direction}">
        ${icon(change.direction === 'up' ? 'arrowUp' : 'arrowDown', { size: 14 })}
        ${Math.abs(change.pct).toFixed(1)}%
      </span>
      <span class="change-period">${t('change_period_month')}</span>
    `;
  }

  if (!cash) return;
  document.getElementById('btn-add-cash-tx').addEventListener('click', () => openTransactionModal({ accountId: cash.id }));
  attachTxListEvents(cash.id);
}
