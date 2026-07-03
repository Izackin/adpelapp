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

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  level_min integer default 1,
  level_max integer default 10,
  title text not null,
  description text,
  activity_type text not null,
  target_count integer default 1,
  xp_reward integer default 10,
  icon text,
  is_active boolean default true,
  created_at timestamp default now()
);

create table if not exists public.user_daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  challenge_id uuid references public.daily_challenges(id) on delete cascade,
  challenge_date date default current_date,
  current_count integer default 0,
  target_count integer default 1,
  completed boolean default false,
  reward_claimed boolean default false,
  completed_at timestamp,
  created_at timestamp default now(),
  unique(user_id, challenge_id, challenge_date)
);

alter table public.daily_challenges enable row level security;
alter table public.user_daily_challenges enable row level security;

drop policy if exists "Todos podem ler desafios ativos" on public.daily_challenges;
create policy "Todos podem ler desafios ativos"
on public.daily_challenges
for select
using (is_active = true);

drop policy if exists "Usuario le proprios desafios" on public.user_daily_challenges;
create policy "Usuario le proprios desafios"
on public.user_daily_challenges
for select
using (auth.uid() = user_id);

drop policy if exists "Usuario cria proprios desafios" on public.user_daily_challenges;
create policy "Usuario cria proprios desafios"
on public.user_daily_challenges
for insert
with check (auth.uid() = user_id);

drop policy if exists "Usuario atualiza proprios desafios" on public.user_daily_challenges;
create policy "Usuario atualiza proprios desafios"
on public.user_daily_challenges
for update
using (auth.uid() = user_id);

create index if not exists idx_daily_challenges_level
on public.daily_challenges(level_min, level_max, is_active);

create index if not exists idx_user_daily_challenges_user_date
on public.user_daily_challenges(user_id, challenge_date);

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 1, 2, 'Ler 1 capitulo', 'Leia um capitulo da Biblia hoje.', 'bible_chapter_read', 1, 10, 'fa-book-bible'
where not exists (select 1 from public.daily_challenges where title = 'Ler 1 capitulo' and activity_type = 'bible_chapter_read');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 1, 4, 'Abrir a Harpa', 'Abra um hino para meditar ou louvar.', 'hymn_opened', 1, 8, 'fa-music'
where not exists (select 1 from public.daily_challenges where title = 'Abrir a Harpa' and activity_type = 'hymn_opened');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 1, 5, 'Assistir 1 aula', 'Conclua uma aula de curso.', 'lesson_watched', 1, 12, 'fa-graduation-cap'
where not exists (select 1 from public.daily_challenges where title = 'Assistir 1 aula' and activity_type = 'lesson_watched');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 2, 6, 'Ler 3 capitulos', 'Avance um pouco mais na leitura biblica.', 'bible_chapter_read', 3, 18, 'fa-book-open-reader'
where not exists (select 1 from public.daily_challenges where title = 'Ler 3 capitulos' and activity_type = 'bible_chapter_read');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 4, 10, 'Ler 5 capitulos', 'Complete cinco capitulos no dia.', 'bible_chapter_read', 5, 30, 'fa-list-ol'
where not exists (select 1 from public.daily_challenges where title = 'Ler 5 capitulos' and activity_type = 'bible_chapter_read');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 5, 10, 'Assistir 2 aulas', 'Conclua duas aulas de curso.', 'lesson_watched', 2, 25, 'fa-graduation-cap'
where not exists (select 1 from public.daily_challenges where title = 'Assistir 2 aulas' and activity_type = 'lesson_watched');

insert into public.daily_challenges (level_min, level_max, title, description, activity_type, target_count, xp_reward, icon)
select 1, 10, 'Registrar uma oferta', 'Use a area de ofertas quando fizer sua contribuicao.', 'offering_made', 1, 15, 'fa-hand-holding-heart'
where not exists (select 1 from public.daily_challenges where title = 'Registrar uma oferta' and activity_type = 'offering_made');
