// Единое хранилище серверных данных + вычисляемые геттеры поверх него.
// state полностью перезаписывается при каждой успешной загрузке (loadAll),
// а не мутируется точечно — это проще и надёжнее для такого размера
// приложения, хотя и означает полный перезапрос всех таблиц на каждое
// изменение (см. README/оценку для обсуждения компромиссов).
import { Api } from './api.js';
import { t, getLang } from './i18n.js';
import { escapeHtml } from './utils.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Имена конкретных членов семьи — личные имена, их не переводит i18n.js.
// Для отображения на других языках держим ручную транслитерацию: новый
// участник без записи здесь просто покажется как есть (это нормально).
const NAME_TRANSLATIONS = {
  'Паша': { en: 'Pasha', uk: 'Паша', he: 'פאשה' },
  'Настя': { en: 'Nastya', uk: 'Настя', he: 'נסטיה' },
  'Эйтан': { en: 'Eitan', uk: 'Ейтан', he: 'איתן' },
};

export function displayMemberName(name) {
  const entry = NAME_TRANSLATIONS[name];
  return (entry && entry[getLang()]) || name;
}

export let state = { members: [], categories: [], accounts: [], transactions: [], checkpoints: [] };

export const ICON_CHOICES = ['💰', '🏦', '🐷', '💳', '🛒', '🍔', '🚗', '🏠', '💊', '🎓', '🎁', '✈️', '📱', '👗', '🎮', '📈', '👶', '⚡', '🧾', '☕', '🐾', '💼'];

export const AVATAR_COLORS = ['#8a9a2e', '#c2861f', '#c2672c', '#5f7a34', '#6a52b3', '#3f8f82'];

export function avatarColor(name) {
  const sum = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// Загружает все 5 таблиц заново и заменяет state целиком.
// Возвращает true при успехе, false при ошибке (и сама рисует баннер ошибки).
export async function loadAll() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('ВСТАВЬТЕ') || SUPABASE_ANON_KEY.includes('ВСТАВЬТЕ')) {
    showSetupNeeded();
    return false;
  }
  try {
    const [members, categories, accounts, transactions, checkpoints] = await Promise.all([
      Api.getMembers(),
      Api.getCategories(),
      Api.getAccounts(),
      Api.getTransactions(),
      Api.getCheckpoints(),
    ]);
    state = { members, categories, accounts, transactions, checkpoints };
    return true;
  } catch (err) {
    showLoadError(err);
    return false;
  }
}

function showSetupNeeded() {
  document.getElementById('app').innerHTML = `<div class="error-banner">${t('setup_needed_html')}</div>`;
}

function showLoadError(err) {
  document.getElementById('app').innerHTML = `
    <div class="error-banner">
      ${t('load_error_html')}
      <small>${escapeHtml(err.message || String(err))}</small>
    </div>`;
}

export function accountBalance(account) {
  if (!account) return 0;
  if (account.type === 'savings') {
    const cps = checkpointsSorted(account.id, 'asc');
    if (cps.length === 0) return Number(account.initial_balance) || 0;
    return Number(cps[cps.length - 1].balance);
  }
  const delta = state.transactions
    .filter((tx) => tx.account_id === account.id)
    .reduce((sum, tx) => sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)), 0);
  return Number(account.initial_balance) + delta;
}

// Чекапы копилки, отсортированные по дате. order: 'asc' | 'desc'.
export function checkpointsSorted(accountId, order) {
  const list = state.checkpoints.filter((c) => c.account_id === accountId).slice();
  list.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  if (order === 'desc') list.reverse();
  return list;
}

export function currentAccountOf(memberId) {
  return state.accounts.find((a) => a.member_id === memberId && a.type === 'current');
}

export function savingsAccountsOf(memberId) {
  return state.accounts.filter((a) => a.member_id === memberId && a.type === 'savings');
}

export function cashAccount() {
  return state.accounts.find((a) => a.type === 'cash');
}

export function accountLabel(accountId) {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return '';
  if (acc.type === 'cash') return t('overview_cash_label');
  const member = state.members.find((m) => m.id === acc.member_id);
  const memberName = member ? displayMemberName(member.name) : '';
  return acc.type === 'current' ? memberName : `${memberName} — ${acc.name}`;
}
