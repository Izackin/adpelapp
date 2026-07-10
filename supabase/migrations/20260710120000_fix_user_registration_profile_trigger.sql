-- ADPEL Digital - Criacao segura de profiles para usuarios do Supabase Auth.
-- Revise e execute manualmente no SQL Editor do Supabase antes da entrega.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles as profile (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.split_part(new.email, '@', 1), ''),
      'Membro'
    ),
    'member'
  )
  on conflict (id) do update
    set full_name = case
      when profile.full_name is null or pg_catalog.btrim(profile.full_name) = ''
        then excluded.full_name
      else profile.full_name
    end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- O RLS atual permite atualizar o proprio perfil. Esta protecao impede que um
-- membro use o cliente web para alterar role, sem bloquear master ou service role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.role := coalesce(new.role, 'member');

    if new.role <> 'member'
      and auth.uid() is not null
      and not exists (
        select 1
        from public.profiles as requester
        where requester.id = auth.uid()
          and requester.role = 'master'
      )
    then
      raise exception 'Somente um master pode definir uma role administrativa.';
    end if;
  elsif new.role is distinct from old.role
    and auth.uid() is not null
    and not exists (
      select 1
      from public.profiles as requester
      where requester.id = auth.uid()
        and requester.role = 'master'
    )
  then
    raise exception 'Somente um master pode alterar roles.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_role() from public;

drop trigger if exists profiles_protect_role on public.profiles;

create trigger profiles_protect_role
  before insert or update of role on public.profiles
  for each row execute function public.protect_profile_role();

-- Preenche somente perfis ausentes e preserva role e nome de perfis existentes.
insert into public.profiles as profile (id, full_name, role)
select
  users.id,
  coalesce(
    nullif(pg_catalog.btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.split_part(users.email, '@', 1), ''),
    'Membro'
  ),
  'member'
from auth.users as users
on conflict (id) do update
  set full_name = case
    when profile.full_name is null or pg_catalog.btrim(profile.full_name) = ''
      then excluded.full_name
    else profile.full_name
  end;

notify pgrst, 'reload schema';
