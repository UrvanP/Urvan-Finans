// Модалки создания/редактирования: операция, копилка (создание/переименование),
// чекап копилки.
import { state } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, todayStr, withBusy } from '../utils.js';
import { openModal, closeModal, renderIconPicker, wireIconPicker } from '../modal.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';

// ---- Модалка операции (доход/расход) ----

export function openTransactionModal({ accountId, transaction }) {
  const isEdit = !!transaction;
  let type = transaction ? transaction.type : 'expense';

  const categoryOptions = (ty) => {
    const options = state.categories
      .filter((c) => c.type === ty)
      .map((c) => `<option value="${c.id}" ${transaction && transaction.category_id === c.id ? 'selected' : ''}>${c.icon ? escapeHtml(c.icon) + ' ' : ''}${escapeHtml(c.name)}</option>`)
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
      <input type="number" id="tx-amount" min="0" step="0.01" inputmode="decimal" value="${transaction ? transaction.amount : ''}" />
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
  document.getElementById('tx-save').addEventListener('click', async (e) => {
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;
    const category_id = document.getElementById('tx-category').value || null;
    const comment = document.getElementById('tx-comment').value.trim();

    if (!amount || amount <= 0) { alert(t('err_amount_positive')); return; }
    if (!date) { alert(t('err_date_required')); return; }

    try {
      await withBusy(e.currentTarget, t('btn_save') + '…', async () => {
        if (isEdit) {
          await Api.updateTransaction(transaction.id, { type, category_id, amount, date, comment });
        } else {
          await Api.addTransaction({ account_id: accountId, category_id, type, amount, date, comment });
        }
      });
      closeModal();
      await refreshApp();
    } catch (err) {
      alert(t('err_tx_save_failed') + err.message);
    }
  });
}

// ---- Копилки: создание, переименование ----

export function openNewSavingsModal({ memberId }) {
  openModal(`
    <h3>${t('savings_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_name')}</label>
      <input type="text" id="new-sav-name" placeholder="${t('name_placeholder_example')}" />
    </div>
    <div class="form-row">
      <label>${t('field_current_amount')}</label>
      <input type="number" id="new-sav-balance" step="0.01" inputmode="decimal" />
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
  document.getElementById('new-sav-save').addEventListener('click', async (e) => {
    const name = document.getElementById('new-sav-name').value.trim();
    const balance = parseFloat(document.getElementById('new-sav-balance').value);
    const date = document.getElementById('new-sav-date').value;
    const comment = document.getElementById('new-sav-comment').value.trim();

    if (!name) { alert(t('err_savings_name_required')); return; }
    if (isNaN(balance)) { alert(t('err_amount_required')); return; }
    if (!date) { alert(t('err_date_required')); return; }

    try {
      await withBusy(e.currentTarget, t('btn_create') + '…', async () => {
        const account = await Api.addAccount({ member_id: memberId, type: 'savings', name, initial_balance: 0, icon: getIcon() });
        await Api.addCheckpoint({ account_id: account.id, date, balance, comment });
      });
      closeModal();
      await refreshApp();
    } catch (err) {
      alert(t('err_savings_create_failed') + err.message);
    }
  });
}

export function openRenameSavingsModal(accountId) {
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
  document.getElementById('rename-save').addEventListener('click', async (e) => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name) { alert(t('err_name_empty')); return; }
    try {
      await withBusy(e.currentTarget, t('btn_save') + '…', () => Api.updateAccount(accountId, { name, icon: getIcon() }));
      closeModal();
      await refreshApp();
    } catch (err) {
      alert(t('err_savings_rename_failed') + err.message);
    }
  });
}

// Модалка добавления/редактирования одного чекапа. Список чекапов
// живёт прямо на странице копилки и обновляется через общий refreshApp().
export function openCheckpointModal({ accountId, checkpoint }) {
  const isEdit = !!checkpoint;
  openModal(`
    <h3>${isEdit ? t('checkpoint_edit_title') : t('checkpoint_new_title')}</h3>
    <div class="form-row">
      <label>${t('field_date')}</label>
      <input type="date" id="cp-date" value="${checkpoint ? checkpoint.date : todayStr()}" />
    </div>
    <div class="form-row">
      <label>${t('field_balance')}</label>
      <input type="number" id="cp-balance" step="0.01" inputmode="decimal" value="${checkpoint ? checkpoint.balance : ''}" />
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

  document.getElementById('cp-save').addEventListener('click', async (e) => {
    const date = document.getElementById('cp-date').value;
    const balance = parseFloat(document.getElementById('cp-balance').value);
    const comment = document.getElementById('cp-comment').value.trim();

    if (!date) { alert(t('err_date_required')); return; }
    if (isNaN(balance)) { alert(t('err_amount_required')); return; }

    try {
      await withBusy(e.currentTarget, t('btn_save') + '…', async () => {
        if (isEdit) {
          await Api.updateCheckpoint(checkpoint.id, { date, balance, comment });
        } else {
          await Api.addCheckpoint({ account_id: accountId, date, balance, comment });
        }
      });
      closeModal();
      await refreshApp();
    } catch (err) {
      alert(t('err_checkpoint_save_failed') + err.message);
    }
  });
}
