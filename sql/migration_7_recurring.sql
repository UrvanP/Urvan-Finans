-- ============================================================
-- Миграция №7: повторяющиеся операции (подписки, зарплата и т.п.).
-- Как использовать: Supabase -> SQL Editor -> вставить -> Run.
-- Ничего из существующих данных не удаляется.
--
-- Операция не создаётся автоматически сама по себе — когда наступает
-- next_date, приложение показывает баннер с предложением подтвердить
-- (тогда создаётся настоящая запись в transactions и next_date сдвигается
-- на следующий период) или пропустить этот раз.
-- ============================================================

create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount > 0),
  comment text,
  frequency text not null check (frequency in ('weekly', 'monthly')) default 'monthly',
  next_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recurring_tx_account_id on recurring_transactions(account_id);

alter table recurring_transactions enable row level security;
create policy "public full access" on recurring_transactions for all using (true) with check (true);
