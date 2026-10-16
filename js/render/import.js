// Импорт банковской выписки (Excel/CSV): угадывание колонок + предпросмотр.
// XLSX — глобальная библиотека с CDN (не ES-модуль), подключена в index.html.
import { state, accountLabel } from '../state.js';
import { t } from '../i18n.js';
import { escapeHtml, formatMoney, formatDate } from '../utils.js';
import { refreshApp } from '../tabs.js';
import { Api } from '../api.js';

let importHeaders = [];
let importParsedRows = null;

// xlsx.full.min.js — тяжёлая библиотека (парсит Excel/CSV), нужна только тем,
// кто реально открывает импорт выписки. Грузим её лениво при первом файле,
// а не на каждой загрузке приложения.
let xlsxLoadPromise = null;
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxLoadPromise) {
    xlsxLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load xlsx library'));
      document.head.appendChild(script);
    });
  }
  return xlsxLoadPromise;
}

function importableAccountOptions() {
  return state.accounts
    .filter((a) => a.type === 'current' || a.type === 'cash')
    .map((a) => `<option value="${a.id}">${escapeHtml(accountLabel(a.id))}</option>`)
    .join('');
}

export function renderImportWidget() {
  return `
    <div class="form-row">
      <label>${t('import_choose_account')}</label>
      <select id="import-account-select">${importableAccountOptions()}</select>
    </div>
    <div class="dropzone" id="import-dropzone">${t('import_drop_hint')}</div>
    <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none" />
    <div id="import-mapping" style="display:none;"></div>
  `;
}

export function attachImportWidgetEvents() {
  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
  });
}

function parseFlexibleDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseFlexibleAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/[₪$€\s]/g, '');
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

function guessColumn(parser) {
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < importHeaders.length; c++) {
    let score = 0;
    importParsedRows.slice(0, 15).forEach((row) => { if (parser(row[c]) !== null) score++; });
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function guessDescColumn() {
  let best = -1;
  let bestLen = 0;
  for (let c = 0; c < importHeaders.length; c++) {
    const sample = importParsedRows.slice(0, 15);
    let totalLen = 0;
    let numericCount = 0;
    sample.forEach((row) => {
      const v = row[c];
      const s = v === undefined ? '' : String(v);
      totalLen += s.length;
      if (parseFlexibleAmount(v) !== null && s.length < 12) numericCount++;
    });
    const avgLen = totalLen / (sample.length || 1);
    if (numericCount < sample.length / 2 && avgLen > bestLen) { bestLen = avgLen; best = c; }
  }
  return best;
}

async function handleImportFile(file) {
  try {
    await loadXlsxLib();
  } catch (err) {
    alert(t('err_file_read') + err.message);
    return;
  }
  const isCsv = /\.csv$/i.test(file.name);
  const reader = new FileReader();
  reader.onerror = () => alert(t('err_file_read') + reader.error);
  reader.onload = (e) => {
    try {
      const wb = isCsv
        ? XLSX.read(e.target.result, { type: 'string' })
        : XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
      if (!rows.length) { alert(t('err_import_no_rows')); return; }
      importHeaders = rows[0].map((h, i) => (h === undefined || h === '' ? `Col ${i + 1}` : String(h)));
      importParsedRows = rows.slice(1).filter((r) => r.some((cell) => cell !== undefined && cell !== ''));
      if (!importParsedRows.length) { alert(t('err_import_no_rows')); return; }
      renderImportMapping();
    } catch (err) {
      alert(t('err_file_read') + err.message);
    }
  };
  if (isCsv) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function renderImportMapping() {
  const wrap = document.getElementById('import-mapping');
  wrap.style.display = 'block';

  const colOptions = (selectedIdx) => importHeaders.map((h, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
  const colOptionsWithNone = (selectedIdx) => `<option value="-1">${t('import_column_none')}</option>${colOptions(selectedIdx)}`;

  const dateGuess = guessColumn(parseFlexibleDate);
  const amountGuess = guessColumn(parseFlexibleAmount);

  wrap.innerHTML = `
    <div class="form-row">
      <label>${t('import_column_date')}</label>
      <select id="imp-col-date">${colOptions(dateGuess)}</select>
    </div>
    <div class="form-row">
      <label>${t('import_amount_mode')}</label>
      <div class="type-toggle" id="imp-amount-mode">
        <button type="button" data-mode="single" class="active">${t('import_amount_single')}</button>
        <button type="button" data-mode="split">${t('import_amount_split')}</button>
      </div>
    </div>
    <div class="form-row" id="imp-single-wrap">
      <label>${t('import_column_amount')}</label>
      <select id="imp-col-amount">${colOptions(amountGuess)}</select>
    </div>
    <div class="form-row" id="imp-split-wrap" style="display:none;">
      <label>${t('import_column_credit')}</label>
      <select id="imp-col-credit">${colOptionsWithNone(-1)}</select>
      <label>${t('import_column_debit')}</label>
      <select id="imp-col-debit">${colOptionsWithNone(-1)}</select>
    </div>
    <div class="form-row">
      <label>${t('import_column_desc')}</label>
      <select id="imp-col-desc">${colOptionsWithNone(guessDescColumn())}</select>
    </div>
    <div>${t('import_rows_found_prefix')}${importParsedRows.length}</div>
    <div class="import-table-wrap" id="imp-preview"></div>
    <div class="modal-actions" style="margin-top:12px;">
      <span></span>
      <button class="btn" id="imp-do-import">${t('btn_import')}</button>
    </div>
  `;

  document.getElementById('imp-amount-mode').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('imp-amount-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      const isSplit = btn.dataset.mode === 'split';
      document.getElementById('imp-single-wrap').style.display = isSplit ? 'none' : '';
      document.getElementById('imp-split-wrap').style.display = isSplit ? '' : 'none';
      renderImportPreview();
    });
  });

  ['imp-col-date', 'imp-col-amount', 'imp-col-credit', 'imp-col-debit', 'imp-col-desc'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderImportPreview);
  });

  document.getElementById('imp-do-import').addEventListener('click', doImport);

  renderImportPreview();
}

function readImportConfig() {
  const dateCol = parseInt(document.getElementById('imp-col-date').value, 10);
  const mode = document.querySelector('#imp-amount-mode button.active').dataset.mode;
  const descCol = parseInt(document.getElementById('imp-col-desc').value, 10);
  const config = { dateCol, mode, descCol };
  if (mode === 'single') {
    config.amountCol = parseInt(document.getElementById('imp-col-amount').value, 10);
  } else {
    config.creditCol = parseInt(document.getElementById('imp-col-credit').value, 10);
    config.debitCol = parseInt(document.getElementById('imp-col-debit').value, 10);
  }
  return config;
}

function buildImportRows(config) {
  const results = [];
  importParsedRows.forEach((row) => {
    const date = parseFlexibleDate(row[config.dateCol]);
    let amount = null;
    let type = null;
    if (config.mode === 'single') {
      const raw = parseFlexibleAmount(row[config.amountCol]);
      if (raw !== null && raw !== 0) { amount = Math.abs(raw); type = raw >= 0 ? 'income' : 'expense'; }
    } else {
      const credit = config.creditCol >= 0 ? parseFlexibleAmount(row[config.creditCol]) : null;
      const debit = config.debitCol >= 0 ? parseFlexibleAmount(row[config.debitCol]) : null;
      if (credit && credit !== 0) { amount = Math.abs(credit); type = 'income'; }
      else if (debit && debit !== 0) { amount = Math.abs(debit); type = 'expense'; }
    }
    const comment = config.descCol >= 0 && row[config.descCol] !== undefined ? String(row[config.descCol]) : '';
    if (date && amount) results.push({ date, amount, type, comment });
  });
  return results;
}

function renderImportPreview() {
  const config = readImportConfig();
  const rows = buildImportRows(config);
  const wrap = document.getElementById('imp-preview');
  const preview = rows.slice(0, 50);
  wrap.innerHTML = `
    <table class="import-table">
      <thead><tr><th>${t('field_date')}</th><th>${t('field_type')}</th><th>${t('field_amount')}</th><th>${t('field_comment')}</th></tr></thead>
      <tbody>
        ${preview.map((r) => `<tr><td>${formatDate(r.date)}</td><td>${r.type === 'income' ? t('type_income') : t('type_expense')}</td><td>${formatMoney(r.amount)}</td><td>${escapeHtml(r.comment)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function doImport() {
  const accountId = document.getElementById('import-account-select').value;
  const config = readImportConfig();
  const rows = buildImportRows(config);
  if (!rows.length) { alert(t('err_import_no_rows')); return; }

  const payload = rows.map((r) => ({
    account_id: accountId,
    category_id: null,
    type: r.type,
    amount: r.amount,
    date: r.date,
    comment: r.comment || null,
  }));

  try {
    await Api.addTransactionsBulk(payload);
    await refreshApp();
    alert(t('import_success_prefix') + payload.length);
  } catch (err) {
    alert(t('err_import_failed') + err.message);
  }
}
