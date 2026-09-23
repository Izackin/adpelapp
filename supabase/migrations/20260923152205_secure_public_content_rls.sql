-- ADPEL Digital - Fase 0, etapa 2.
-- Consolida RLS e grants das seis tabelas de conteudo publico/administrativo.
-- O helper public.is_admin_master() ja existente e a fonte canonica de autorizacao.

do $$
begin
  if to_regprocedure('public.is_admin_master()') is null then
    raise exception 'A funcao canonica public.is_admin_master() nao existe.';
  end if;
end;
$$;

alter table public.announcements enable row level security;
alter table public.courses enable row level security;
alter table public.events enable row level security;
alter table public.home_sections enable row level security;
alter table public.library_books enable row level security;
alter table public.studies enable row level security;

-- Remove o conjunto historico de policies permissivas e sobrepostas somente
-- nas seis tabelas deste ajuste. As policies canonicas sao recriadas abaixo.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'announcements',
        'courses',
        'events',
        'home_sections',
        'library_books',
        'studies'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

-- Grants de tabela: anon somente le; authenticated pode executar o CRUD que
-- o painel usa, mas as policies abaixo autorizam escrita exclusivamente ao master.
revoke all privileges on table
  public.announcements,
  public.courses,
  public.events,
  public.home_sections,
  public.library_books,
  public.studies
from public, anon, authenticated;

grant select on table
  public.announcements,
  public.courses,
  public.events,
  public.home_sections,
  public.library_books,
  public.studies
to anon, authenticated;

grant insert, update, delete on table
  public.announcements,
  public.courses,
  public.events,
  public.home_sections,
  public.library_books,
  public.studies
to authenticated;

-- ANNOUNCEMENTS
create policy announcements_public_select
  on public.announcements
  for select
  to anon, authenticated
  using (
    (
      is_published is true
      and is_active is true
      and (start_date is null or start_date <= current_date)
      and (
        coalesce(expiry, end_date) is null
        or coalesce(expiry, end_date) >= current_date
      )
    )
    or (select public.is_admin_master())
  );

create policy announcements_master_insert
  on public.announcements
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy announcements_master_update
  on public.announcements
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy announcements_master_delete
  on public.announcements
  for delete
  to authenticated
  using ((select public.is_admin_master()));

-- COURSES
create policy courses_public_select
  on public.courses
  for select
  to anon, authenticated
  using (is_published is true or (select public.is_admin_master()));

create policy courses_master_insert
  on public.courses
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy courses_master_update
  on public.courses
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy courses_master_delete
  on public.courses
  for delete
  to authenticated
  using ((select public.is_admin_master()));

-- EVENTS
create policy events_public_select
  on public.events
  for select
  to anon, authenticated
  using (
    (is_published is true and is_active is true)
    or (select public.is_admin_master())
  );

create policy events_master_insert
  on public.events
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy events_master_update
  on public.events
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy events_master_delete
  on public.events
  for delete
  to authenticated
  using ((select public.is_admin_master()));

-- HOME SECTIONS
create policy home_sections_public_select
  on public.home_sections
  for select
  to anon, authenticated
  using (is_active is true or (select public.is_admin_master()));

create policy home_sections_master_insert
  on public.home_sections
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy home_sections_master_update
  on public.home_sections
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy home_sections_master_delete
  on public.home_sections
  for delete
  to authenticated
  using ((select public.is_admin_master()));

-- LIBRARY BOOKS
create policy library_books_public_select
  on public.library_books
  for select
  to anon, authenticated
  using (is_published is true or (select public.is_admin_master()));

create policy library_books_master_insert
  on public.library_books
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy library_books_master_update
  on public.library_books
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy library_books_master_delete
  on public.library_books
  for delete
  to authenticated
  using ((select public.is_admin_master()));

-- STUDIES
create policy studies_public_select
  on public.studies
  for select
  to anon, authenticated
  using (is_published is true or (select public.is_admin_master()));

create policy studies_master_insert
  on public.studies
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy studies_master_update
  on public.studies
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy studies_master_delete
  on public.studies
  for delete
  to authenticated
  using ((select public.is_admin_master()));

comment on policy announcements_public_select on public.announcements is
  'Anon e membros leem somente avisos publicados, ativos e dentro da validade; master le todos.';
comment on policy courses_public_select on public.courses is
  'Anon e membros leem somente cursos publicados; master le todos.';
comment on policy events_public_select on public.events is
  'Anon e membros leem somente eventos publicados e ativos; master le todos.';
comment on policy home_sections_public_select on public.home_sections is
  'Anon e membros leem somente secoes ativas; master le todas.';
comment on policy library_books_public_select on public.library_books is
  'Anon e membros leem somente livros publicados; master le todos.';
comment on policy studies_public_select on public.studies is
  'Anon e membros leem somente estudos publicados; master le todos.';

notify pgrst, 'reload schema';
