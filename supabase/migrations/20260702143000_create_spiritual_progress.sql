-- ============================================================
-- ADPEL Digital - Minha Caminhada
-- Progresso espiritual gamificado, mantendo historico por usuario.
-- Execute no SQL Editor do Supabase caso a migracao automatica nao esteja disponivel.
-- ============================================================

create table if not exists public.spiritual_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  avatar text,
  church_id uuid,
  total_points integer default 0,
  streak_days integer default 0,
  longest_streak integer default 0,
  bible_reads integer default 0,
  bible_chapters integer default 0,
  bible_books integer default 0,
  hymns_opened integer default 0,
  studies_completed integer default 0,
  courses_completed integer default 0,
  prayers_made integer default 0,
  offerings integer default 0,
  missions_completed integer default 0,
  level integer default 1,
  xp integer default 0,
  last_activity date,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.spiritual_progress enable row level security;

drop policy if exists "Own Progress Select" on public.spiritual_progress;
create policy "Own Progress Select"
on public.spiritual_progress
for select
using (auth.uid() = user_id);

drop policy if exists "Own Progress Insert" on public.spiritual_progress;
create policy "Own Progress Insert"
on public.spiritual_progress
for insert
with check (auth.uid() = user_id);

drop policy if exists "Own Progress Update" on public.spiritual_progress;
create policy "Own Progress Update"
on public.spiritual_progress
for update
using (auth.uid() = user_id);

drop policy if exists "Ranking Public" on public.spiritual_progress;
create policy "Ranking Public"
on public.spiritual_progress
for select
using (true);

create index if not exists idx_spiritual_progress_user_id
on public.spiritual_progress(user_id);

create index if not exists idx_spiritual_progress_ranking
on public.spiritual_progress(total_points desc, streak_days desc);
