-- ============================================================
-- Миграция №2: чекапы (периодическая история баланса) для копилок.
-- Как использовать: Supabase -> SQL Editor -> вставить -> Run.
-- Ничего из существующих данных не удаляется.
-- ============================================================

create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  date date not null default current_date,
  balance numeric not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkpoints_account_id on checkpoints(account_id);

alter table checkpoints enable row level security;
create policy "public full access" on checkpoints for all using (true) with check (true);
