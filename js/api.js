// Все обращения к Supabase собраны в одном месте, чтобы остальной код
// не думал про SQL/запросы, а просто вызывал понятные функции.
import { db } from './supabaseClient.js';

export const Api = {
  // ---------- members ----------
  async getMembers() {
    const { data, error } = await db.from('members').select('*').order('created_at');
    if (error) throw error;
    return data;
  },

  async addMember(name) {
    const { data, error } = await db.from('members').insert({ name }).select().single();
    if (error) throw error;
    // У каждого члена семьи должен быть текущий счёт — создаём сразу,
    // как это делает sql/schema.sql для начальных трёх членов семьи.
    const { error: accErr } = await db
      .from('accounts')
      .insert({ member_id: data.id, type: 'current', name: 'Текущий счёт', initial_balance: 0 });
    if (accErr) throw accErr;
    return data;
  },

  async updateMember(id, fields) {
    const { error } = await db.from('members').update(fields).eq('id', id);
    if (error) throw error;
  },

  // Каскадно удаляет счета/операции/чекапы этого члена семьи (FK on delete cascade).
  async deleteMember(id) {
    const { error } = await db.from('members').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- categories ----------
  async getCategories() {
    const { data, error } = await db.from('categories').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async addCategory(name, type, icon) {
    const { data, error } = await db.from('categories').insert({ name, type, icon: icon || null }).select().single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, fields) {
    const { error } = await db.from('categories').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteCategory(id) {
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- accounts ----------
  async getAccounts() {
    const { data, error } = await db.from('accounts').select('*').order('created_at');
    if (error) throw error;
    return data;
  },

  async addAccount({ member_id, type, name, initial_balance, icon, goal_amount, currency }) {
    const { data, error } = await db
      .from('accounts')
      .insert({ member_id, type, name, initial_balance: initial_balance || 0, icon: icon || null, goal_amount: goal_amount || null, currency: currency || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAccount(id, fields) {
    const { error } = await db.from('accounts').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteAccount(id) {
    const { error } = await db.from('accounts').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- transactions ----------
  async getTransactions() {
    const { data, error } = await db.from('transactions').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async addTransaction({ account_id, category_id, type, amount, date, comment }) {
    const { data, error } = await db
      .from('transactions')
      .insert({ account_id, category_id, type, amount, date, comment })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTransaction(id, fields) {
    const { error } = await db.from('transactions').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteTransaction(id) {
    const { error } = await db.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // Пакетная вставка (например, импорт выписки из Excel)
  async addTransactionsBulk(rows) {
    const { data, error } = await db.from('transactions').insert(rows).select();
    if (error) throw error;
    return data;
  },

  // ---------- checkpoints (история баланса копилок) ----------
  async getCheckpoints() {
    const { data, error } = await db.from('checkpoints').select('*').order('date');
    if (error) throw error;
    return data;
  },

  async addCheckpoint({ account_id, date, balance, comment }) {
    const { data, error } = await db
      .from('checkpoints')
      .insert({ account_id, date, balance, comment })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCheckpoint(id, fields) {
    const { error } = await db.from('checkpoints').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteCheckpoint(id) {
    const { error } = await db.from('checkpoints').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------- budgets (месячный лимит на категорию расходов) ----------
  async getBudgets() {
    const { data, error } = await db.from('budgets').select('*');
    if (error) throw error;
    return data;
  },

  // Один лимит на категорию — upsert по category_id вместо отдельных
  // add/update, чтобы вызывающему коду не нужно было знать, есть ли уже
  // запись для этой категории.
  async setBudget(category_id, monthly_limit) {
    const { data, error } = await db
      .from('budgets')
      .upsert({ category_id, monthly_limit }, { onConflict: 'category_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBudget(category_id) {
    const { error } = await db.from('budgets').delete().eq('category_id', category_id);
    if (error) throw error;
  },

  // ---------- recurring_transactions (подписки, зарплата и т.п.) ----------
  async getRecurringTransactions() {
    const { data, error } = await db.from('recurring_transactions').select('*').order('next_date');
    if (error) throw error;
    return data;
  },

  async addRecurringTransaction({ account_id, category_id, type, amount, comment, frequency, next_date }) {
    const { data, error } = await db
      .from('recurring_transactions')
      .insert({ account_id, category_id, type, amount, comment: comment || null, frequency, next_date })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRecurringTransaction(id, fields) {
    const { error } = await db.from('recurring_transactions').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteRecurringTransaction(id) {
    const { error } = await db.from('recurring_transactions').delete().eq('id', id);
    if (error) throw error;
  },
};
