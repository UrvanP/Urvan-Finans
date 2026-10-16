// Вкладка "Настройки": участники семьи, категории, экспорт, импорт из банка.
import { state, accountLabel, avatarColor, displayMemberName } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, downloadCsv, withBusy } from '../utils.js';
import { openModal, closeModal, renderIconPicker, wireIconPicker, confirmDialog } from '../modal.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';
import { renderImportWidget, attachImportWidgetEvents } from './import.js';
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
      <label>${t('field_name')}</label>
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
    if (!name) { alert(t('err_member_name_required')); return; }
    try {
      await withBusy(e.currentTarget, (isEdit ? t('btn_save') : t('btn_create')) + '…', () => (
        isEdit ? Api.updateMember(member.id, { name }) : Api.addMember(name)
      ));
      closeModal();
      await refreshApp();
    } catch (err) {
      alert((isEdit ? t('err_member_rename_failed') : t('err_member_add_failed')) + err.message);
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
        alert(t('err_member_delete_failed') + err.message);
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

export function renderSettingsTab() {
  const income = state.categories.filter((c) => c.type === 'income');
  const expense = state.categories.filter((c) => c.type === 'expense');

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

export function attachSettingsEvents() {
  attachMembersSectionEvents();

  const getNewCatIcon = wireIconPicker('new-cat-icon-picker', null);

  let newType = 'expense';
  const typeToggle = document.getElementById('new-cat-type-toggle');
  typeToggle.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      newType = btn.dataset.type;
      typeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('cat-add').addEventListener('click', async (e) => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) { alert(t('err_category_name_required')); return; }
    try {
      await withBusy(e.currentTarget, t('btn_add') + '…', () => Api.addCategory(name, newType, getNewCatIcon()));
      await refreshApp();
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
    row.querySelector('.cat-save').addEventListener('click', async (e) => {
      const name = row.querySelector('.cat-name-input').value.trim();
      if (!name) { alert(t('err_name_empty')); return; }
      try {
        await withBusy(e.currentTarget, '…', () => Api.updateCategory(id, { name }));
        await refreshApp();
      } catch (err) {
        alert(t('err_category_rename_failed') + err.message);
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
        alert(t('err_category_delete_failed') + err.message);
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
