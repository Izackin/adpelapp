-- ADPEL Digital - central de missoes diarias com XP calculado no banco.
-- Mantem o catalogo extensivel e remove escrita direta do navegador em progresso/recompensas.

alter table public.spiritual_progress
  alter column user_id set not null;

create unique index if not exists spiritual_progress_user_id_key
  on public.spiritual_progress(user_id);

alter table public.daily_challenges
  add column if not exists mission_key text,
  add column if not exists cadence text not null default 'daily',
  add column if not exists display_order integer not null default 0,
  add column if not exists action_target text;

create unique index if not exists daily_challenges_mission_key_key
  on public.daily_challenges(mission_key)
  where mission_key is not null;

update public.daily_challenges
set is_active = false
where is_active is true;

insert into public.daily_challenges (
  mission_key,
  cadence,
  display_order,
  action_target,
  level_min,
  level_max,
  title,
  description,
  activity_type,
  target_count,
  xp_reward,
  icon,
  is_active
)
values
  ('daily_return', 'daily', 10, 'journey', 1, 10, 'Volte à ADPEL', 'Seu retorno de hoje mantém a caminhada em movimento.', 'daily_visit', 1, 10, 'fa-fire', true),
  ('verse_of_day', 'daily', 20, 'home', 1, 10, 'Leia o versículo do dia', 'Reserve alguns instantes para ler e refletir.', 'verse_of_day_read', 1, 10, 'fa-scroll', true),
  ('bible_chapter', 'daily', 30, 'bible', 1, 10, 'Leia a Bíblia', 'Marque um capítulo como lido na Bíblia ADPEL.', 'bible_chapter_read', 1, 20, 'fa-book-bible', true),
  ('course_lesson', 'daily', 40, 'courses', 1, 10, 'Continue aprendendo', 'Conclua uma aula de um curso em andamento.', 'lesson_watched', 1, 30, 'fa-graduation-cap', true)
on conflict (mission_key) where mission_key is not null do update
set cadence = excluded.cadence,
    display_order = excluded.display_order,
    action_target = excluded.action_target,
    level_min = excluded.level_min,
    level_max = excluded.level_max,
    title = excluded.title,
    description = excluded.description,
    activity_type = excluded.activity_type,
    target_count = excluded.target_count,
    xp_reward = excluded.xp_reward,
    icon = excluded.icon,
    is_active = excluded.is_active;

create table if not exists public.journey_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  source_key text,
  event_key text not null,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists journey_activity_events_user_date_idx
  on public.journey_activity_events(user_id, occurred_on desc);

create table if not exists public.journey_daily_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_date date not null,
  xp_earned integer not null default 0 check (xp_earned >= 0),
  completed_at timestamptz not null default now(),
  unique (user_id, completion_date)
);

create index if not exists journey_daily_completions_user_date_idx
  on public.journey_daily_completions(user_id, completion_date desc);

alter table public.journey_activity_events enable row level security;
alter table public.journey_daily_completions enable row level security;

drop policy if exists journey_activity_events_select_own on public.journey_activity_events;
create policy journey_activity_events_select_own
  on public.journey_activity_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists journey_daily_completions_select_own on public.journey_daily_completions;
create policy journey_daily_completions_select_own
  on public.journey_daily_completions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('spiritual_progress', 'user_daily_challenges')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

revoke insert, update, delete on public.spiritual_progress from anon, authenticated;
revoke insert, update, delete on public.daily_challenges from anon, authenticated;
revoke insert, update, delete on public.user_daily_challenges from anon, authenticated;
revoke all on public.journey_activity_events from anon, authenticated;
revoke all on public.journey_daily_completions from anon, authenticated;

grant select on public.spiritual_progress to anon, authenticated;
grant select on public.daily_challenges to anon, authenticated;
grant select on public.user_daily_challenges to authenticated;
grant select on public.journey_activity_events to authenticated;
grant select on public.journey_daily_completions to authenticated;

create or replace function public.get_daily_missions()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  requesting_user uuid := auth.uid();
  local_today date := (timezone('America/Sao_Paulo', now()))::date;
  current_level integer := 1;
  progress_payload jsonb;
  missions_payload jsonb;
  completed_count integer := 0;
  total_count integer := 0;
  completion_xp integer := 0;
begin
  if requesting_user is null then
    raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
  end if;

  insert into public.spiritual_progress (user_id, user_name, level, xp, total_points)
  select
    requesting_user,
    coalesce(nullif(p.public_name, ''), nullif(p.full_name, ''), 'Membro'),
    1,
    0,
    0
  from (select 1) seed
  left join public.profiles p on p.id = requesting_user
  on conflict (user_id) do nothing;

  select greatest(1, least(10, coalesce(sp.level, 1)))
  into current_level
  from public.spiritual_progress sp
  where sp.user_id = requesting_user;

  insert into public.user_daily_challenges (
    user_id,
    challenge_id,
    challenge_date,
    current_count,
    target_count,
    completed,
    reward_claimed
  )
  select
    requesting_user,
    dc.id,
    local_today,
    0,
    greatest(1, dc.target_count),
    false,
    false
  from public.daily_challenges dc
  where dc.is_active is true
    and dc.cadence = 'daily'
    and current_level between dc.level_min and dc.level_max
  on conflict (user_id, challenge_id, challenge_date) do nothing;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', udc.id,
      'challenge_id', dc.id,
      'mission_key', dc.mission_key,
      'title', dc.title,
      'description', dc.description,
      'activity_type', dc.activity_type,
      'action_target', dc.action_target,
      'icon', dc.icon,
      'xp_reward', dc.xp_reward,
      'current_count', udc.current_count,
      'target_count', udc.target_count,
      'completed', udc.completed,
      'reward_claimed', udc.reward_claimed,
      'completed_at', udc.completed_at
    ) order by dc.display_order, dc.created_at
  ), '[]'::jsonb),
  count(*),
  count(*) filter (where udc.completed is true)
  into missions_payload, total_count, completed_count
  from public.user_daily_challenges udc
  join public.daily_challenges dc on dc.id = udc.challenge_id
  where udc.user_id = requesting_user
    and udc.challenge_date = local_today
    and dc.is_active is true
    and dc.cadence = 'daily';

  select to_jsonb(sp)
  into progress_payload
  from public.spiritual_progress sp
  where sp.user_id = requesting_user;

  select coalesce(jdc.xp_earned, 0)
  into completion_xp
  from public.journey_daily_completions jdc
  where jdc.user_id = requesting_user
    and jdc.completion_date = local_today;

  return jsonb_build_object(
    'progress', progress_payload,
    'missions', missions_payload,
    'mission_date', local_today,
    'completed_count', completed_count,
    'total_count', total_count,
    'day_completed', total_count > 0 and completed_count = total_count,
    'completion_xp', completion_xp
  );
end;
$$;

create or replace function public.record_journey_action(
  action_type text,
  source_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  requesting_user uuid := auth.uid();
  local_today date := (timezone('America/Sao_Paulo', now()))::date;
  normalized_source text := nullif(btrim(coalesce(source_key, '')), '');
  unique_event_key text;
  inserted_event uuid;
  mission_reward integer := 0;
  completed_day_id uuid;
  snapshot jsonb;
  book_id_value text;
  chapter_value integer;
  course_id_value uuid;
  lesson_index_value integer;
begin
  if requesting_user is null then
    raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
  end if;

  if action_type not in (
    'daily_visit',
    'verse_of_day_read',
    'bible_open',
    'bible_chapter_read',
    'bible_book_completed',
    'hymn_opened',
    'lesson_watched',
    'course_completed',
    'offering_made'
  ) then
    raise exception 'Acao de caminhada invalida.' using errcode = '22023';
  end if;

  if length(coalesce(normalized_source, '')) > 180 then
    raise exception 'Identificador de origem invalido.' using errcode = '22023';
  end if;

  perform public.get_daily_missions();

  perform 1
  from public.spiritual_progress sp
  where sp.user_id = requesting_user
  for update;

  if action_type = 'bible_chapter_read' then
    if normalized_source is null or normalized_source !~ '^[A-Z0-9]{3}:[0-9]{1,3}$' then
      raise exception 'Leitura biblica sem origem valida.' using errcode = '22023';
    end if;
    book_id_value := split_part(normalized_source, ':', 1);
    chapter_value := split_part(normalized_source, ':', 2)::integer;
    if not exists (
      select 1 from public.bible_reading_progress brp
      where brp.user_id = requesting_user
        and brp.book_id = book_id_value
        and brp.chapter = chapter_value
        and brp.is_read is true
    ) then
      raise exception 'A leitura precisa estar registrada na Biblia.' using errcode = 'P0001';
    end if;
  elsif action_type = 'lesson_watched' then
    if normalized_source is null or normalized_source !~ '^[0-9a-fA-F-]{36}:[0-9]+$' then
      raise exception 'Aula sem origem valida.' using errcode = '22023';
    end if;
    course_id_value := split_part(normalized_source, ':', 1)::uuid;
    lesson_index_value := split_part(normalized_source, ':', 2)::integer;
    if not exists (
      select 1 from public.user_lesson_progress ulp
      where ulp.user_id = requesting_user
        and ulp.course_id = course_id_value
        and ulp.lesson_index = lesson_index_value
        and coalesce(ulp.completed, true) is true
    ) then
      raise exception 'A aula precisa estar concluida no curso.' using errcode = 'P0001';
    end if;
  elsif action_type = 'course_completed' then
    if normalized_source is null or normalized_source !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'Curso sem origem valida.' using errcode = '22023';
    end if;
    course_id_value := normalized_source::uuid;
    if not exists (
      select 1
      from public.courses c
      where c.id = course_id_value
        and jsonb_typeof(coalesce(c.lessons, '[]'::jsonb)) = 'array'
        and jsonb_array_length(coalesce(c.lessons, '[]'::jsonb)) > 0
        and (
          select count(*)
          from public.user_lesson_progress ulp
          where ulp.user_id = requesting_user
            and ulp.course_id = c.id
            and coalesce(ulp.completed, true) is true
        ) >= jsonb_array_length(coalesce(c.lessons, '[]'::jsonb))
    ) then
      raise exception 'O curso ainda nao foi concluido.' using errcode = 'P0001';
    end if;
  elsif action_type = 'bible_book_completed' then
    if normalized_source is null or normalized_source !~ '^[A-Z0-9]{3}$' then
      raise exception 'Livro biblico sem origem valida.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.bible_completed_books bcb
      where bcb.user_id = requesting_user
        and bcb.book_id = normalized_source
    ) then
      raise exception 'A conclusao do livro precisa estar registrada.' using errcode = 'P0001';
    end if;
  end if;

  unique_event_key := case
    when action_type in ('bible_chapter_read', 'lesson_watched', 'course_completed', 'bible_book_completed')
      then action_type || ':' || normalized_source
    else action_type || ':' || local_today::text || ':' || coalesce(normalized_source, 'daily')
  end;

  insert into public.journey_activity_events (
    user_id,
    activity_type,
    source_key,
    event_key,
    occurred_on
  )
  values (
    requesting_user,
    action_type,
    normalized_source,
    unique_event_key,
    local_today
  )
  on conflict (user_id, event_key) do nothing
  returning id into inserted_event;

  if inserted_event is null then
    snapshot := public.get_daily_missions();
    return snapshot || jsonb_build_object('action_recorded', false, 'xp_awarded', 0);
  end if;

  select coalesce(sum(dc.xp_reward), 0)
  into mission_reward
  from public.user_daily_challenges udc
  join public.daily_challenges dc on dc.id = udc.challenge_id
  where udc.user_id = requesting_user
    and udc.challenge_date = local_today
    and dc.is_active is true
    and dc.cadence = 'daily'
    and dc.activity_type = action_type
    and coalesce(udc.completed, false) is false
    and coalesce(udc.current_count, 0) + 1 >= greatest(1, udc.target_count);

  update public.user_daily_challenges udc
  set current_count = least(greatest(1, udc.target_count), coalesce(udc.current_count, 0) + 1),
      completed = coalesce(udc.current_count, 0) + 1 >= greatest(1, udc.target_count),
      reward_claimed = case
        when coalesce(udc.current_count, 0) + 1 >= greatest(1, udc.target_count) then true
        else coalesce(udc.reward_claimed, false)
      end,
      completed_at = case
        when coalesce(udc.current_count, 0) + 1 >= greatest(1, udc.target_count) then now()
        else udc.completed_at
      end,
      updated_at = now()
  from public.daily_challenges dc
  where dc.id = udc.challenge_id
    and udc.user_id = requesting_user
    and udc.challenge_date = local_today
    and dc.is_active is true
    and dc.cadence = 'daily'
    and dc.activity_type = action_type
    and coalesce(udc.completed, false) is false;

  update public.spiritual_progress sp
  set bible_reads = coalesce(sp.bible_reads, 0) + case when action_type = 'bible_open' then 1 else 0 end,
      bible_chapters = coalesce(sp.bible_chapters, 0) + case when action_type = 'bible_chapter_read' then 1 else 0 end,
      bible_books = coalesce(sp.bible_books, 0) + case when action_type = 'bible_book_completed' then 1 else 0 end,
      hymns_opened = coalesce(sp.hymns_opened, 0) + case when action_type = 'hymn_opened' then 1 else 0 end,
      courses_completed = coalesce(sp.courses_completed, 0) + case when action_type = 'course_completed' then 1 else 0 end,
      offerings = coalesce(sp.offerings, 0) + case when action_type = 'offering_made' then 1 else 0 end,
      xp = coalesce(sp.xp, 0) + mission_reward,
      total_points = coalesce(sp.total_points, 0) + mission_reward,
      level = case
        when coalesce(sp.xp, 0) + mission_reward >= 4300 then 10
        when coalesce(sp.xp, 0) + mission_reward >= 3300 then 9
        when coalesce(sp.xp, 0) + mission_reward >= 2500 then 8
        when coalesce(sp.xp, 0) + mission_reward >= 1850 then 7
        when coalesce(sp.xp, 0) + mission_reward >= 1300 then 6
        when coalesce(sp.xp, 0) + mission_reward >= 850 then 5
        when coalesce(sp.xp, 0) + mission_reward >= 500 then 4
        when coalesce(sp.xp, 0) + mission_reward >= 250 then 3
        when coalesce(sp.xp, 0) + mission_reward >= 100 then 2
        else 1
      end,
      updated_at = now()
  where sp.user_id = requesting_user;

  if exists (
    select 1
    from public.user_daily_challenges udc
    join public.daily_challenges dc on dc.id = udc.challenge_id
    where udc.user_id = requesting_user
      and udc.challenge_date = local_today
      and dc.is_active is true
      and dc.cadence = 'daily'
  ) and not exists (
    select 1
    from public.user_daily_challenges udc
    join public.daily_challenges dc on dc.id = udc.challenge_id
    where udc.user_id = requesting_user
      and udc.challenge_date = local_today
      and dc.is_active is true
      and dc.cadence = 'daily'
      and coalesce(udc.completed, false) is false
  ) then
    insert into public.journey_daily_completions (user_id, completion_date, xp_earned)
    select
      requesting_user,
      local_today,
      coalesce(sum(dc.xp_reward), 0)
    from public.user_daily_challenges udc
    join public.daily_challenges dc on dc.id = udc.challenge_id
    where udc.user_id = requesting_user
      and udc.challenge_date = local_today
      and dc.is_active is true
      and dc.cadence = 'daily'
    on conflict (user_id, completion_date) do nothing
    returning id into completed_day_id;

    if completed_day_id is not null then
      update public.spiritual_progress sp
      set streak_days = case
            when sp.last_activity = local_today - 1 then coalesce(sp.streak_days, 0) + 1
            when sp.last_activity = local_today then greatest(1, coalesce(sp.streak_days, 0))
            else 1
          end,
          longest_streak = greatest(
            coalesce(sp.longest_streak, 0),
            case
              when sp.last_activity = local_today - 1 then coalesce(sp.streak_days, 0) + 1
              when sp.last_activity = local_today then greatest(1, coalesce(sp.streak_days, 0))
              else 1
            end
          ),
          missions_completed = coalesce(sp.missions_completed, 0) + 1,
          last_activity = local_today,
          updated_at = now()
      where sp.user_id = requesting_user;
    end if;
  end if;

  snapshot := public.get_daily_missions();
  return snapshot || jsonb_build_object(
    'action_recorded', true,
    'xp_awarded', mission_reward,
    'day_completed_now', completed_day_id is not null
  );
end;
$$;

revoke all on function public.get_daily_missions() from public, anon;
revoke all on function public.record_journey_action(text, text) from public, anon;
grant execute on function public.get_daily_missions() to authenticated, service_role;
grant execute on function public.record_journey_action(text, text) to authenticated, service_role;

comment on function public.get_daily_missions() is
  'Cria e retorna as missoes diarias do usuario autenticado sem aceitar valores de XP do cliente.';
comment on function public.record_journey_action(text, text) is
  'Registra uma acao permitida, valida evidencias disponiveis, deduplica eventos e concede recompensas fixadas no banco.';

notify pgrst, 'reload schema';
