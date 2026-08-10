-- ============================================================
-- Схема базы данных для приложения "Семейный бюджет"
-- Как использовать: откройте в Supabase раздел "SQL Editor",
-- вставьте весь этот файл и нажмите Run.
-- ============================================================

-- Включаем расширение для генерации uuid (в новых проектах Supabase обычно уже включено)
create extension if not exists "pgcrypto";

-- 1) Члены семьи
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2) Категории доходов/расходов (пользователь сам добавляет/переименовывает/удаляет)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text,
  created_at timestamptz not null default now()
);

-- 3) Счета/"карманы". member_id = NULL означает общую семейную наличность
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  type text not null check (type in ('current', 'savings', 'cash')),
  name text not null,
  icon text,
  initial_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 4) Операции (доход/расход) по конкретному счёту
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  comment text,
  created_at timestamptz not null default now()
);

-- 5) Чекапы — периодическая история баланса для копилок/пенсий/инвестиций
-- (вместо записи каждой операции просто фиксируем баланс на дату)
create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  date date not null default current_date,
  balance numeric not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_member_id on accounts(member_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_category_id on transactions(category_id);
create index if not exists idx_checkpoints_account_id on checkpoints(account_id);

-- ============================================================
-- Row Level Security: на этом этапе приложения нет логина,
-- поэтому открываем полный доступ всем, кто использует anon key.
-- Когда добавите авторизацию — эти политики нужно будет заменить.
-- ============================================================

alter table members enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table checkpoints enable row level security;

create policy "public full access" on members for all using (true) with check (true);
create policy "public full access" on categories for all using (true) with check (true);
create policy "public full access" on accounts for all using (true) with check (true);
create policy "public full access" on transactions for all using (true) with check (true);
create policy "public full access" on checkpoints for all using (true) with check (true);

-- ============================================================
-- Начальные данные: три члена семьи + пара примеров категорий
-- ============================================================

insert into members (name) values ('Паша'), ('Настя'), ('Эйтан');

insert into categories (name, type) values
  ('Зарплата', 'income'),
  ('Продукты', 'expense');

-- Для каждого члена семьи сразу создаём текущий счёт
insert into accounts (member_id, type, name, initial_balance)
select id, 'current', 'Текущий счёт', 0 from members;

-- Общая семейная наличность (member_id = NULL)
insert into accounts (member_id, type, name, initial_balance)
values (null, 'cash', 'Общая наличность', 0);
