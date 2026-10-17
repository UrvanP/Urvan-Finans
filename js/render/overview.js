// Вкладка "Общий статус": гейдж ликвидных средств, карточки участников,
// графики и операции по общей наличности.
import { state, cashAccount, currentAccountOf, accountBalance, avatarColor, displayMemberName, isForeignCurrency, currencySymbol, overBudgetCategories, dueRecurringTransactions, advanceRecurringDate } from '../state.js';
import { t } from '../i18n.js';
import { formatMoney, escapeHtml, animateCountUp, todayStr, withBusy } from '../utils.js';
import { renderPeriodControl, attachPeriodControl, renderNetWorthLineChart, drawPieChart, renderExpenseTable, drawRadialGauge, computeNetWorthMonthlyChange } from '../charts.js';
import { renderTxSection, attachTxListEvents } from './transactions.js';
import { openTransactionModal } from './modalForms.js';
import { alertDialog } from '../modal.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';
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

// Баннер уведомлений: превышенные бюджеты категорий + повторяющиеся операции,
// у которых наступил срок. Появляется при каждом открытии/обновлении
// приложения (см. README/обсуждение) — никаких системных разрешений не
// требует, это просто часть обычной разметки Общего статуса.
function renderNotificationsBanner() {
  const overBudget = overBudgetCategories();
  const due = dueRecurringTransactions();
  if (!overBudget.length && !due.length) return '';

  const budgetRows = overBudget.map((x) => `
    <div class="notif-row">
      <span>⚠ ${t('notif_budget_exceeded_prefix')} «${escapeHtml(x.category.name)}» ${t('notif_budget_exceeded_suffix')}
        <span class="money-value">${formatMoney(x.spent)}</span> / <span class="money-value">${formatMoney(Number(x.budget.monthly_limit))}</span></span>
    </div>`).join('');

  const recurringRows = due.map((r) => {
    const cat = state.categories.find((c) => c.id === r.category_id);
    const catLabel = cat ? (cat.icon ? escapeHtml(cat.icon) + ' ' : '') + escapeHtml(cat.name) : t('no_category_label');
    const sign = r.type === 'income' ? '+' : '−';
    return `
    <div class="notif-row" data-rec-id="${r.id}">
      <span>🔁 ${t('notif_recurring_due_prefix')} ${catLabel} — <span class="tx-amount money-value ${r.type}">${sign} ${formatMoney(r.amount)}</span></span>
      <div class="notif-row-actions">
        <button class="btn btn-small notif-confirm">${t('notif_recurring_confirm_btn')}</button>
        <button class="btn btn-ghost btn-small notif-skip">${t('notif_recurring_skip_btn')}</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="card notif-banner" id="notif-banner">${budgetRows}${recurringRows}</div>`;
}

function attachNotificationsBannerEvents() {
  document.querySelectorAll('#notif-banner .notif-row[data-rec-id]').forEach((row) => {
    const id = row.dataset.recId;
    const rule = state.recurring.find((r) => r.id === id);
    if (!rule) return;

    row.querySelector('.notif-confirm').addEventListener('click', async (e) => {
      try {
        await withBusy(e.currentTarget, '…', async () => {
          await Api.addTransaction({ account_id: rule.account_id, category_id: rule.category_id, type: rule.type, amount: rule.amount, date: todayStr(), comment: rule.comment });
          await Api.updateRecurringTransaction(rule.id, { next_date: advanceRecurringDate(rule.next_date, rule.frequency) });
        });
        await refreshApp();
      } catch (err) {
        alertDialog(t('err_recurring_confirm_failed') + err.message);
      }
    });

    row.querySelector('.notif-skip').addEventListener('click', async (e) => {
      try {
        await withBusy(e.currentTarget, '…', () => Api.updateRecurringTransaction(rule.id, { next_date: advanceRecurringDate(rule.next_date, rule.frequency) }));
        await refreshApp();
      } catch (err) {
        alertDialog(t('err_recurring_confirm_failed') + err.message);
      }
    });
  });
}

export function renderOverview() {
  const cash = cashAccount();
  const memberBalances = state.members.map((m) => ({
    member: m,
    balance: accountBalance(currentAccountOf(m.id)),
    color: avatarColor(m.name),
  }));
  // Копилки в другой валюте (без конвертации) не входят в общую сумму —
  // показываем их отдельной строкой, сгруппировав по валюте.
  const savingsAccounts = state.accounts.filter((a) => a.type === 'savings');
  const savingsTotal = savingsAccounts
    .filter((a) => !isForeignCurrency(a))
    .reduce((sum, a) => sum + accountBalance(a), 0);
  const foreignByCurrency = {};
  savingsAccounts.filter(isForeignCurrency).forEach((a) => {
    foreignByCurrency[a.currency] = (foreignByCurrency[a.currency] || 0) + accountBalance(a);
  });
  const foreignSummary = Object.entries(foreignByCurrency)
    .map(([code, sum]) => formatMoney(sum, currencySymbol(code)))
    .join(', ');
  const cashBalance = accountBalance(cash);

  return `
    ${renderNotificationsBanner()}
    ${renderMonthlySummaryBanner()}
    <div class="card gauge-card">
      <div id="overview-total-gauge"></div>
      <div id="overview-gauge-change"></div>
    </div>
    <div class="summary-grid">
      ${memberBalances.map((x) => `
        <div class="card balance-card accent" style="border-inline-start-color:${x.color}">
          <div class="label">${escapeHtml(displayMemberName(x.member.name))}${t('overview_current_suffix')}</div>
          <div class="amount money-value">${formatMoney(x.balance)}</div>
        </div>`).join('')}
      <div class="card balance-card accent" style="border-inline-start-color:var(--accent-cash)">
        <div class="label">${t('overview_cash_label')}</div>
        <div class="amount money-value">${formatMoney(cashBalance)}</div>
      </div>
      <div class="card balance-card accent" style="border-inline-start-color:var(--accent-savings)">
        <div class="label">${t('overview_savings_total')}</div>
        <div class="amount money-value">${formatMoney(savingsTotal)}</div>
      </div>
    </div>
    ${foreignSummary ? `<div class="foreign-currency-note">${t('foreign_currency_accounts_label')}: <span class="money-value">${foreignSummary}</span></div>` : ''}

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
  attachNotificationsBannerEvents();

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
    .filter((a) => a.type === 'savings' && !isForeignCurrency(a))
    .reduce((sum, a) => sum + accountBalance(a), 0);
  const liquidTotal = state.members
    .reduce((s, m) => s + accountBalance(currentAccountOf(m.id)), 0) + accountBalance(cash);
  drawRadialGauge('overview-total-gauge', {
    fraction: liquidTotal / ((liquidTotal + savingsTotal) || 1),
    centerHtml: `<span class="money-value" id="overview-total-gauge-value">${formatMoney(liquidTotal)}</span>`,
    label: t('overview_liquid_total'),
  });
  animateCountUp(document.getElementById('overview-total-gauge-value'), liquidTotal, formatMoney);

  const change = computeNetWorthMonthlyChange();
  const changeEl = document.getElementById('overview-gauge-change');
  if (change) {
    const arrowIcon = change.direction === 'up' ? 'arrowUp' : change.direction === 'down' ? 'arrowDown' : null;
    changeEl.innerHTML = `
      <span class="change-badge ${change.direction}">
        ${arrowIcon ? icon(arrowIcon, { size: 14 }) : ''}
        ${Math.abs(change.pct).toFixed(1)}%
      </span>
      <span class="change-period">${t('change_period_month')}</span>
    `;
  }

  if (!cash) return;
  document.getElementById('btn-add-cash-tx').addEventListener('click', () => openTransactionModal({ accountId: cash.id }));
  attachTxListEvents(cash.id);
}
