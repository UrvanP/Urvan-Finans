// Все обращения к Supabase собраны в одном месте, чтобы app.js
// не думал про SQL/запросы, а просто вызывал понятные функции.

const Api = {
  // ---------- members ----------
  async getMembers() {
    const { data, error } = await db.from('members').select('*').order('created_at');
    if (error) throw error;
    return data;
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

  async addAccount({ member_id, type, name, initial_balance, icon }) {
    const { data, error } = await db
      .from('accounts')
      .insert({ member_id, type, name, initial_balance: initial_balance || 0, icon: icon || null })
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
};
