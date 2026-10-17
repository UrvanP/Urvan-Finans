// Модалки создания/редактирования: операция, копилка (создание/переименование),
// чекап копилки.
import { state, CURRENCIES } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, todayStr, withBusy } from '../utils.js';
import { openModal, closeModal, renderIconPicker, wireIconPicker, renderToggleGroup, wireToggleGroup, alertDialog, confirmDialog } from '../modal.js';
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
      ${renderToggleGroup('tx-type-toggle', [
        { value: 'expense', label: t('type_expense') },
        { value: 'income', label: t('type_income') },
      ], type)}
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
      ${isEdit ? `<button class="btn btn-danger" id="tx-delete">${t('btn_delete')}</button>` : '<span></span>'}
      <div style="display:flex; gap:10px;">
        <button class="btn btn-ghost" id="tx-cancel">${t('btn_cancel')}</button>
        <button class="btn" id="tx-save">${t('btn_save')}</button>
      </div>
    </div>
  `);

  wireToggleGroup('tx-type-toggle', (value) => {
    type = value;
    document.getElementById('tx-category').innerHTML = categoryOptions(type);
  });

  document.getElementById('tx-cancel').addEventListener('click', closeModal);

  const deleteBtn = document.getElementById('tx-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!(await confirmDialog(t('confirm_delete_transaction')))) return;
      deleteBtn.disabled = true;
      try {
        await Api.deleteTransaction(transaction.id);
        closeModal();
        await refreshApp();
      } catch (err) {
        deleteBtn.disabled = false;
        alertDialog(t('err_tx_delete_failed') + err.message);
      }
    });
  }

  document.getElementById('tx-save').addEventListener('click', async (e) => {
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;
    const category_id = document.getElementById('tx-category').value || null;
    const comment = document.getElementById('tx-comment').value.trim();

    if (!amount || amount <= 0) { alertDialog(t('err_amount_positive')); return; }
    if (!date) { alertDialog(t('err_date_required')); return; }

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
      alertDialog(t('err_tx_save_failed') + err.message);
    }
  });
}

// ---- Копилки: создание, переименование ----

// Без конвертации валют (см. state.js/isForeignCurrency) — выбор валюты
// только меняет, в чём показывается сумма этого конкретного счёта.
function currencyOptions(selected) {
  const current = selected || 'ILS';
  return CURRENCIES.map((c) => `<option value="${c.code}" ${current === c.code ? 'selected' : ''}>${c.code} (${c.symbol})</option>`).join('');
}

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
      <label>${t('field_goal_amount')}</label>
      <input type="number" id="new-sav-goal" min="0" step="0.01" inputmode="decimal" />
    </div>
    <div class="form-row">
      <label>${t('field_currency')}</label>
      <select id="new-sav-currency">${currencyOptions('ILS')}</select>
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
    const goalInput = document.getElementById('new-sav-goal').value;
    const goal_amount = goalInput ? parseFloat(goalInput) : null;
    const currency = document.getElementById('new-sav-currency').value;
    const date = document.getElementById('new-sav-date').value;
    const comment = document.getElementById('new-sav-comment').value.trim();

    if (!name) { alertDialog(t('err_savings_name_required')); return; }
    if (isNaN(balance)) { alertDialog(t('err_amount_required')); return; }
    if (!date) { alertDialog(t('err_date_required')); return; }

    try {
      await withBusy(e.currentTarget, t('btn_create') + '…', async () => {
        const account = await Api.addAccount({ member_id: memberId, type: 'savings', name, initial_balance: 0, icon: getIcon(), goal_amount, currency });
        await Api.addCheckpoint({ account_id: account.id, date, balance, comment });
      });
      closeModal();
      await refreshApp();
    } catch (err) {
      alertDialog(t('err_savings_create_failed') + err.message);
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
      <label>${t('field_goal_amount')}</label>
      <input type="number" id="rename-goal" min="0" step="0.01" inputmode="decimal" value="${account.goal_amount != null ? account.goal_amount : ''}" />
    </div>
    <div class="form-row">
      <label>${t('field_currency')}</label>
      <select id="rename-currency">${currencyOptions(account.currency)}</select>
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
    const goalInput = document.getElementById('rename-goal').value;
    const goal_amount = goalInput ? parseFloat(goalInput) : null;
    const currency = document.getElementById('rename-currency').value;
    if (!name) { alertDialog(t('err_name_empty')); return; }
    try {
      await withBusy(e.currentTarget, t('btn_save') + '…', () => Api.updateAccount(accountId, { name, icon: getIcon(), goal_amount, currency }));
      closeModal();
      await refreshApp();
    } catch (err) {
      alertDialog(t('err_savings_rename_failed') + err.message);
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

    if (!date) { alertDialog(t('err_date_required')); return; }
    if (isNaN(balance)) { alertDialog(t('err_amount_required')); return; }

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
      alertDialog(t('err_checkpoint_save_failed') + err.message);
    }
  });
}
