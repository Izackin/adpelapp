-- ADPEL Digital - Fase 0, etapa 8.
-- Corrige as quatro falhas de RLS e privacidade confirmadas na regressao.

do $$
declare
  policy_record record;
begin
  if to_regprocedure('public.is_admin_master()') is null then
    raise exception 'A funcao canonica public.is_admin_master() nao existe.';
  end if;

  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('push_subscriptions', 'certificates', 'app_updates')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;

  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
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

alter table public.push_subscriptions enable row level security;
alter table public.certificates enable row level security;
alter table public.app_updates enable row level security;
alter table public.profiles enable row level security;

revoke all privileges on table
  public.push_subscriptions,
  public.certificates,
  public.app_updates
from public, anon, authenticated;

grant select, insert, update, delete on table public.push_subscriptions
  to authenticated;

grant select, insert, update, delete on table public.certificates
  to authenticated;

grant select on table public.app_updates
  to anon, authenticated;
grant insert, update, delete on table public.app_updates
  to authenticated;

revoke all privileges on table public.profiles from public, anon;
grant select, insert, update, delete on table public.profiles
  to authenticated;

create policy push_subscriptions_select_own_or_master
  on public.push_subscriptions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  );

create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  to authenticated
  with check (
    user_id is not null
    and user_id = (select auth.uid())
  );

create policy push_subscriptions_update_own_or_master
  on public.push_subscriptions
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  )
  with check (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  );

create policy push_subscriptions_delete_own_or_master
  on public.push_subscriptions
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  );

create policy certificates_select_own_or_master
  on public.certificates
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  );

create policy certificates_insert_own_or_master
  on public.certificates
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or (select public.is_admin_master())
  );

create policy certificates_update_master
  on public.certificates
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy certificates_delete_master
  on public.certificates
  for delete
  to authenticated
  using ((select public.is_admin_master()));

create policy app_updates_public_select
  on public.app_updates
  for select
  to anon, authenticated
  using (
    is_active is true
    or (select public.is_admin_master())
  );

create policy app_updates_master_insert
  on public.app_updates
  for insert
  to authenticated
  with check ((select public.is_admin_master()));

create policy app_updates_master_update
  on public.app_updates
  for update
  to authenticated
  using ((select public.is_admin_master()))
  with check ((select public.is_admin_master()));

create policy app_updates_master_delete
  on public.app_updates
  for delete
  to authenticated
  using ((select public.is_admin_master()));

create policy profiles_select_self_or_master
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin_master())
  );

-- A view usa os privilegios do owner de forma deliberada: a tabela base nao e
-- consultavel por anon, e a projecao abaixo aplica filtro de linha e mascara o
-- telefone antes de qualquer dado chegar ao cliente.
create view public.public_profiles
with (security_barrier = true)
as
select
  id,
  full_name,
  public_name,
  bio,
  avatar_url,
  favorite_verse,
  ministry,
  case when show_phone is true then phone else null end as phone,
  instagram,
  coalesce(show_phone, false) as show_phone,
  coalesce(show_public_profile, true) as show_public_profile,
  coalesce(show_in_ranking, true) as show_in_ranking
from public.profiles
where coalesce(show_public_profile, true) is true;

revoke all privileges on table public.public_profiles
  from public, anon, authenticated;
grant select on table public.public_profiles
  to anon, authenticated;

comment on view public.public_profiles is
  'Projecao publica de profiles: exclui perfis privados e mascara phone quando show_phone nao e true.';

notify pgrst, 'reload schema';
