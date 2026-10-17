// Вкладка "Настройки": участники семьи, категории, экспорт, импорт из банка.
import { state, accountLabel, avatarColor, displayMemberName, budgetFor, currentMonthSpentByCategory } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, downloadCsv, withBusy, formatMoney, formatDate } from '../utils.js';
import { openModal, closeModal, renderIconPicker, wireIconPicker, renderToggleGroup, wireToggleGroup, confirmDialog, alertDialog } from '../modal.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';
import { renderImportWidget, attachImportWidgetEvents } from './import.js';
import { openRecurringModal } from './modalForms.js';
import { icon } from '../icons.js';

// ---- Участники семьи ----

function renderMemberRow(m) {
  const displayName = displayMemberName(m.name);
  return `
    <div class="member-row" data-id="${m.id}">
      <span class="tab-avatar" style="background:${avatarColor(m.name)}">${escapeHtml(displayName.charAt(0).toUpperCase())}</span>
      <span class="member-row-name">${escapeHtml(displayName)}</span>
      <button class="icon-btn member-edit" title="${t('edit_title')}">${icon('pencil', { size: 17 })}</button>
      <button class="icon-btn member-delete" title="${t('delete_title')}">${icon('trash', { size: 17 })}</button>
    </div>`;
}

function openMemberModal(member) {
  const isEdit = !!member;
  openModal(`
    <h3>${isEdit ? t('member_rename_title') : t('member_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_person_name')}</label>
      <input type="text" id="member-name-input" placeholder="${t('member_name_placeholder')}" value="${isEdit ? escapeHtml(member.name) : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="member-cancel">${t('btn_cancel')}</button>
      <button class="btn" id="member-save">${isEdit ? t('btn_save') : t('btn_create')}</button>
    </div>
  `);

  document.getElementById('member-cancel').addEventListener('click', closeModal);
  document.getElementById('member-save').addEventListener('click', async (e) => {
    const name = document.getElementById('member-name-input').value.trim();
    if (!name) { alertDialog(t('err_member_name_required')); return; }
    try {
      await withBusy(e.currentTarget, (isEdit ? t('btn_save') : t('btn_create')) + '…', () => (
        isEdit ? Api.updateMember(member.id, { name }) : Api.addMember(name)
      ));
      closeModal();
      await refreshApp();
    } catch (err) {
      alertDialog((isEdit ? t('err_member_rename_failed') : t('err_member_add_failed')) + err.message);
    }
  });
}

function attachMembersSectionEvents() {
  document.getElementById('btn-add-member').addEventListener('click', () => openMemberModal(null));
  document.querySelectorAll('#members-list .member-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('.member-edit').addEventListener('click', () => {
      const member = state.members.find((m) => m.id === id);
      openMemberModal(member);
    });
    row.querySelector('.member-delete').addEventListener('click', async () => {
      if (!(await confirmDialog(t('confirm_delete_member')))) return;
      const btn = row.querySelector('.member-delete');
      btn.disabled = true;
      try {
        await Api.deleteMember(id);
        await refreshApp();
      } catch (err) {
        btn.disabled = false;
        alertDialog(t('err_member_delete_failed') + err.message);
      }
    });
  });
}

// ---- Категории ----

function catRow(c) {
  return `
    <div class="category-row" data-id="${c.id}">
      <span class="item-icon">${c.icon ? escapeHtml(c.icon) : ''}</span>
      <input type="text" value="${escapeHtml(c.name)}" class="cat-name-input" />
      <button class="icon-btn cat-save" title="${t('save_name_title')}">${icon('check', { size: 17 })}</button>
      <button class="icon-btn cat-delete" title="${t('delete_title')}">${icon('trash', { size: 17 })}</button>
    </div>`;
}

// ---- Бюджеты: один повторяющийся месячный лимит на категорию расходов ----

function budgetRow(c, spentMap) {
  const b = budgetFor(c.id);
  const spent = spentMap[c.id] || 0;
  const over = b && spent > Number(b.monthly_limit);
  const pct = b ? (spent / Number(b.monthly_limit)) * 100 : 0;
  return `
    <div class="budget-row" data-cat-id="${c.id}">
      <div class="budget-row-top">
        <span class="item-icon">${c.icon ? escapeHtml(c.icon) : ''}</span>
        <span class="budget-row-name">${escapeHtml(c.name)}</span>
        <input type="number" class="budget-limit-input" min="0" step="0.01" inputmode="decimal" placeholder="${t('budget_no_limit')}" value="${b ? b.monthly_limit : ''}" />
        <button class="icon-btn budget-save" title="${t('save_name_title')}">${icon('check', { size: 17 })}</button>
      </div>
      ${b ? `
        <div class="goal-progress">
          <div class="expense-row-bar-track">
            <div class="expense-row-bar" style="width:${Math.min(100, pct).toFixed(1)}%; background:${over ? 'var(--expense)' : 'var(--accent)'}"></div>
          </div>
          <div class="goal-progress-text">${formatMoney(spent)} / ${formatMoney(Number(b.monthly_limit))}${over ? ' · ' + t('budget_exceeded_label') : ''}</div>
        </div>
      ` : ''}
    </div>`;
}

function attachBudgetEvents() {
  document.querySelectorAll('#budgets-list .budget-row').forEach((row) => {
    const categoryId = row.dataset.catId;
    row.querySelector('.budget-save').addEventListener('click', async (e) => {
      const input = row.querySelector('.budget-limit-input');
      const value = input.value.trim();
      const btn = e.currentTarget;
      try {
        await withBusy(btn, '…', async () => {
          if (!value) await Api.deleteBudget(categoryId);
          else await Api.setBudget(categoryId, parseFloat(value));
        });
        await refreshApp();
      } catch (err) {
        alertDialog(t('err_budget_save_failed') + err.message);
      }
    });
  });
}

// ---- Повторяющиеся операции ----

function recurringRow(r) {
  const cat = state.categories.find((c) => c.id === r.category_id);
  const catLabel = cat ? (cat.icon ? escapeHtml(cat.icon) + ' ' : '') + escapeHtml(cat.name) : t('no_category_label');
  const freqLabel = r.frequency === 'weekly' ? t('frequency_weekly') : t('frequency_monthly');
  const sign = r.type === 'income' ? '+' : '−';
  return `
    <div class="tx-card" data-id="${r.id}">
      <div class="tx-info">
        <span class="tx-category">${catLabel} · ${escapeHtml(accountLabel(r.account_id))}</span>
        <span class="tx-meta">${freqLabel} · ${t('recurring_next_label')} ${formatDate(r.next_date)}</span>
      </div>
      <div class="tx-amount money-value ${r.type}">${sign} ${formatMoney(r.amount)}</div>
      <div class="tx-actions">
        <button class="icon-btn rec-edit" title="${t('edit_title')}">${icon('pencil', { size: 17 })}</button>
      </div>
    </div>`;
}

function attachRecurringEvents() {
  document.getElementById('btn-add-recurring').addEventListener('click', () => openRecurringModal());
  document.querySelectorAll('#recurring-list .tx-card').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('.rec-edit').addEventListener('click', () => {
      const rule = state.recurring.find((r) => r.id === id);
      openRecurringModal({ rule });
    });
  });
}

export function renderSettingsTab() {
  const income = state.categories.filter((c) => c.type === 'income');
  const expense = state.categories.filter((c) => c.type === 'expense');
  const spentMap = currentMonthSpentByCategory();

  return `
    <div class="settings-section">
      <h2>${t('settings_members_title')}</h2>
      <div id="members-list">${state.members.map(renderMemberRow).join('') || `<div class="empty-hint">${t('empty_no_categories')}</div>`}</div>
      <button class="btn btn-ghost btn-small" id="btn-add-member">${t('add_member_btn')}</button>
    </div>

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
        ${renderToggleGroup('new-cat-type-toggle', [
          { value: 'expense', label: t('type_expense') },
          { value: 'income', label: t('type_income') },
        ], 'expense')}
      </div>
      <div class="form-row">
        <label>${t('icon_picker_label')}</label>
        ${renderIconPicker('new-cat-icon-picker', null)}
      </div>
      <button class="btn" id="cat-add">${t('btn_add')}</button>
    </div>

    <div class="settings-section">
      <h2>${t('settings_budgets_title')}</h2>
      <p class="hint-text">${t('settings_budgets_hint')}</p>
      <div id="budgets-list">${expense.map((c) => budgetRow(c, spentMap)).join('') || `<div class="empty-hint">${t('empty_no_categories')}</div>`}</div>
    </div>

    <div class="settings-section">
      <h2>${t('settings_recurring_title')}</h2>
      <p class="hint-text">${t('settings_recurring_hint')}</p>
      <div id="recurring-list">${state.recurring.map(recurringRow).join('') || `<div class="empty-hint">${t('empty_no_recurring')}</div>`}</div>
      <button class="btn btn-ghost btn-small" id="btn-add-recurring">${t('add_recurring_btn')}</button>
    </div>

    <div class="settings-section">
      <h2>${t('settings_data_title')}</h2>
      <button class="btn btn-ghost btn-small" id="btn-export-tx" style="margin-inline-end:8px;">${t('export_transactions_btn')}</button>
      <button class="btn btn-ghost btn-small" id="btn-export-cp">${t('export_checkpoints_btn')}</button>
    </div>

    <div class="settings-section">
      <h2>${t('import_bank_title')}</h2>
      <p class="hint-text">${t('import_bank_hint')}</p>
      ${renderImportWidget()}
    </div>
  `;
}

export function attachSettingsEvents() {
  attachMembersSectionEvents();
  attachBudgetEvents();
  attachRecurringEvents();

  const getNewCatIcon = wireIconPicker('new-cat-icon-picker', null);

  let newType = 'expense';
  wireToggleGroup('new-cat-type-toggle', (value) => { newType = value; });

  document.getElementById('cat-add').addEventListener('click', async (e) => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) { alertDialog(t('err_category_name_required')); return; }
    try {
      await withBusy(e.currentTarget, t('btn_add') + '…', () => Api.addCategory(name, newType, getNewCatIcon()));
      await refreshApp();
    } catch (err) {
      alertDialog(t('err_category_add_failed') + err.message);
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
    row.querySelector('.cat-save').addEventListener('click', async (e) => {
      const name = row.querySelector('.cat-name-input').value.trim();
      if (!name) { alertDialog(t('err_name_empty')); return; }
      try {
        await withBusy(e.currentTarget, '…', () => Api.updateCategory(id, { name }));
        await refreshApp();
      } catch (err) {
        alertDialog(t('err_category_rename_failed') + err.message);
      }
    });
    row.querySelector('.cat-delete').addEventListener('click', async () => {
      if (!(await confirmDialog(t('confirm_delete_category')))) return;
      const btn = row.querySelector('.cat-delete');
      btn.disabled = true;
      try {
        await Api.deleteCategory(id);
        await refreshApp();
      } catch (err) {
        btn.disabled = false;
        alertDialog(t('err_category_delete_failed') + err.message);
      }
    });
  });
}

// ---- Экспорт CSV ----

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
