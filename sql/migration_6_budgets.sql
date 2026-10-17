-- ============================================================
-- Миграция №6: лимиты бюджета по категориям расходов.
-- Как использовать: Supabase -> SQL Editor -> вставить -> Run.
-- Ничего из существующих данных не удаляется.
--
-- Один лимит на категорию — он ежемесячный и повторяется сам собой: не нужно
-- заново настраивать бюджет каждый месяц, приложение само сравнивает лимит
-- с тратами по этой категории за ТЕКУЩИЙ календарный месяц.
-- ============================================================

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null unique references categories(id) on delete cascade,
  monthly_limit numeric not null check (monthly_limit > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_budgets_category_id on budgets(category_id);

alter table budgets enable row level security;
create policy "public full access" on budgets for all using (true) with check (true);
