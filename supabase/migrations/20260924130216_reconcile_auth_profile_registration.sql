-- Reconcile the Auth -> profiles registration path with the live role model.
-- The canonical roles in public.profiles are "user" and "master".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  insert into public.profiles as profile (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.split_part(new.email, '@', 1), ''),
      'Membro'
    ),
    'user'
  )
  on conflict (id) do update
    set full_name = case
      when profile.full_name is null or pg_catalog.btrim(profile.full_name) = ''
        then excluded.full_name
      else profile.full_name
    end;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin_master() then
      new.role := 'user';
    end if;
  elsif new.role is distinct from old.role
    and not public.is_admin_master()
  then
    raise exception 'Somente um master pode alterar roles.';
  end if;

  return new;
end;
$function$;

revoke all on function public.prevent_role_escalation() from public, anon, authenticated;
grant execute on function public.prevent_role_escalation() to service_role;

-- Remove the alternate local-only guard before installing the canonical trigger.
drop trigger if exists profiles_protect_role on public.profiles;
drop function if exists public.protect_profile_role();

drop trigger if exists trg_prevent_role_escalation on public.profiles;

create trigger trg_prevent_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_role_escalation();

notify pgrst, 'reload schema';
