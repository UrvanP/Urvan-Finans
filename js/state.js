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

export let state = { members: [], categories: [], accounts: [], transactions: [], checkpoints: [], budgets: [] };

// Таблицы, добавленные уже после первого релиза (budgets и т.п.), могут ещё
// не существовать в чьей-то базе, пока не выполнена соответствующая
// миграция — в этом случае Supabase вернёт ошибку "relation does not exist".
// Без этой обёртки Promise.all в loadAll() упал бы целиком и сломал бы
// приложение полностью до выполнения миграции, хотя сама функция не
// обязательна для работы остального приложения.
async function fetchOptional(apiCall, fallback) {
  try {
    return await apiCall();
  } catch (err) {
    return fallback;
  }
}

export const ICON_CHOICES = ['💰', '🏦', '🐷', '💳', '🛒', '🍔', '🚗', '🏠', '💊', '🎓', '🎁', '✈️', '📱', '👗', '🎮', '📈', '👶', '⚡', '🧾', '☕', '🐾', '💼'];

export const AVATAR_COLORS = ['#8a9a2e', '#c2861f', '#c2672c', '#5f7a34', '#a65d3f', '#9c7a3c'];

// Мультивалютность — без конвертации (см. README): счёт в другой валюте
// просто показывается в своей валюте и не участвует в общих суммах (ликвидность,
// "Копилки и накопления") — так решил пользователь, чтобы не тащить курсы валют.
export const CURRENCIES = [
  { code: 'ILS', symbol: '₪' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'RUB', symbol: '₽' },
  { code: 'UAH', symbol: '₴' },
];

export function currencySymbol(code) {
  const found = CURRENCIES.find((c) => c.code === code);
  return found ? found.symbol : '₪';
}

// true для счёта, у которого явно выбрана валюта, отличная от основной (₪).
export function isForeignCurrency(account) {
  return !!(account && account.currency && account.currency !== 'ILS');
}

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
    const [members, categories, accounts, transactions, checkpoints, budgets] = await Promise.all([
      Api.getMembers(),
      Api.getCategories(),
      Api.getAccounts(),
      Api.getTransactions(),
      Api.getCheckpoints(),
      fetchOptional(() => Api.getBudgets(), []),
    ]);
    state = { members, categories, accounts, transactions, checkpoints, budgets };
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

// ---- Бюджеты: лимит повторяется каждый месяц сам собой, поэтому "сколько
// потрачено" всегда считается за ТЕКУЩИЙ календарный месяц, а не за месяц
// создания лимита. ----

export function budgetFor(categoryId) {
  return state.budgets.find((b) => b.category_id === categoryId) || null;
}

export function currentMonthSpentByCategory() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const map = {};
  state.transactions.forEach((tx) => {
    if (tx.type !== 'expense' || !tx.category_id) return;
    if (tx.date < from || tx.date >= to) return;
    map[tx.category_id] = (map[tx.category_id] || 0) + Number(tx.amount);
  });
  return map;
}

// Список категорий, где текущие траты за месяц превысили лимит — используется
// и в Настройках (показать где именно превышено), и в баннере уведомлений.
export function overBudgetCategories() {
  const spent = currentMonthSpentByCategory();
  return state.budgets
    .map((b) => {
      const category = state.categories.find((c) => c.id === b.category_id);
      const spentAmount = spent[b.category_id] || 0;
      return { budget: b, category, spent: spentAmount };
    })
    .filter((x) => x.category && x.spent > Number(x.budget.monthly_limit));
}
