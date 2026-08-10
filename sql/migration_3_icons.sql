-- ============================================================
-- Миграция №3: иконки (эмодзи) для категорий и копилок.
-- Как использовать: Supabase -> SQL Editor -> вставить -> Run.
-- Ничего из существующих данных не удаляется.
-- ============================================================

alter table categories add column if not exists icon text;
alter table accounts add column if not exists icon text;
