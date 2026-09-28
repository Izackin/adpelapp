-- ADPEL Digital - Google Calendar -> Agenda ADPEL.
-- Credenciais ficam no Vault; a tabela publica guarda apenas metadados seguros.

create table if not exists public.calendar_integrations (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'google',
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text,
  calendar_name text,
  calendar_timezone text,
  sync_token text,
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_error text,
  watch_channel_id uuid,
  watch_resource_id text,
  watch_token_hash text,
  watch_expires_at timestamptz,
  refresh_token_secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_integrations_provider_check
    check (provider = 'google'),
  constraint calendar_integrations_status_check
    check (status in ('connected', 'active', 'error', 'disconnected')),
  constraint calendar_integrations_user_provider_unique
    unique (user_id, provider)
);

create index if not exists calendar_integrations_watch_lookup_idx
  on public.calendar_integrations (watch_channel_id, watch_resource_id)
  where watch_channel_id is not null and watch_resource_id is not null;

create index if not exists calendar_integrations_watch_expiry_idx
  on public.calendar_integrations (watch_expires_at)
  where status = 'active' and watch_expires_at is not null;

create table if not exists public.calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_oauth_states_expiry_idx
  on public.calendar_oauth_states (expires_at);

alter table public.calendar_integrations enable row level security;
alter table public.calendar_oauth_states enable row level security;

revoke all privileges on table public.calendar_integrations
  from public, anon, authenticated;
revoke all privileges on table public.calendar_oauth_states
  from public, anon, authenticated;

grant select, insert, update, delete on table public.calendar_integrations
  to authenticated;

drop policy if exists calendar_integrations_master_select on public.calendar_integrations;
drop policy if exists calendar_integrations_master_insert on public.calendar_integrations;
drop policy if exists calendar_integrations_master_update on public.calendar_integrations;
drop policy if exists calendar_integrations_master_delete on public.calendar_integrations;

create policy calendar_integrations_master_select
  on public.calendar_integrations
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_admin_master())
  );

create policy calendar_integrations_master_insert
  on public.calendar_integrations
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_admin_master())
  );

create policy calendar_integrations_master_update
  on public.calendar_integrations
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_admin_master())
  )
  with check (
    user_id = (select auth.uid())
    and (select public.is_admin_master())
  );

create policy calendar_integrations_master_delete
  on public.calendar_integrations
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_admin_master())
  );

create or replace function public.set_calendar_integration_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all privileges on function public.set_calendar_integration_updated_at()
  from public, anon, authenticated;
grant execute on function public.set_calendar_integration_updated_at()
  to service_role;

drop trigger if exists set_calendar_integrations_updated_at
  on public.calendar_integrations;
create trigger set_calendar_integrations_updated_at
before update on public.calendar_integrations
for each row execute function public.set_calendar_integration_updated_at();

-- RPCs exclusivas do service_role fazem a ponte entre Edge Functions e Vault.
-- O refresh token nunca e retornado a anon/authenticated nem armazenado em texto.
create or replace function public.set_google_calendar_refresh_token(
  target_user_id uuid,
  new_refresh_token text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_secret_id uuid;
  stored_secret_id uuid;
begin
  if target_user_id is null
    or new_refresh_token is null
    or char_length(new_refresh_token) not between 20 and 4096 then
    raise exception 'Refresh token invalido.' using errcode = '22023';
  end if;

  select integration.refresh_token_secret_id
    into current_secret_id
  from public.calendar_integrations integration
  where integration.user_id = target_user_id
    and integration.provider = 'google'
  for update;

  if not found then
    raise exception 'Integracao Google nao encontrada.' using errcode = 'P0002';
  end if;

  if current_secret_id is not null
    and exists (select 1 from vault.secrets secret_row where secret_row.id = current_secret_id) then
    perform vault.update_secret(
      current_secret_id,
      new_refresh_token,
      'adpel_google_calendar_refresh_' || target_user_id::text,
      'Refresh token Google Calendar do administrador ADPEL'
    );
    stored_secret_id := current_secret_id;
  else
    stored_secret_id := vault.create_secret(
      new_refresh_token,
      'adpel_google_calendar_refresh_' || target_user_id::text,
      'Refresh token Google Calendar do administrador ADPEL'
    );
    update public.calendar_integrations
      set refresh_token_secret_id = stored_secret_id
      where user_id = target_user_id and provider = 'google';
  end if;

  return stored_secret_id;
end;
$$;

create or replace function public.get_google_calendar_refresh_token(
  target_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select secret_row.decrypted_secret
  from public.calendar_integrations integration
  join vault.decrypted_secrets secret_row
    on secret_row.id = integration.refresh_token_secret_id
  where integration.user_id = target_user_id
    and integration.provider = 'google';
$$;

create or replace function public.delete_google_calendar_refresh_token(
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_secret_id uuid;
begin
  select integration.refresh_token_secret_id
    into current_secret_id
  from public.calendar_integrations integration
  where integration.user_id = target_user_id
    and integration.provider = 'google'
  for update;

  update public.calendar_integrations
    set refresh_token_secret_id = null
    where user_id = target_user_id and provider = 'google';

  if current_secret_id is not null then
    delete from vault.secrets where id = current_secret_id;
    return true;
  end if;

  return false;
end;
$$;

revoke all privileges on function public.set_google_calendar_refresh_token(uuid, text)
  from public, anon, authenticated;
revoke all privileges on function public.get_google_calendar_refresh_token(uuid)
  from public, anon, authenticated;
revoke all privileges on function public.delete_google_calendar_refresh_token(uuid)
  from public, anon, authenticated;

grant execute on function public.set_google_calendar_refresh_token(uuid, text)
  to service_role;
grant execute on function public.get_google_calendar_refresh_token(uuid)
  to service_role;
grant execute on function public.delete_google_calendar_refresh_token(uuid)
  to service_role;

comment on table public.calendar_integrations is
  'Metadados seguros da integracao Google Calendar. Tokens permanecem no Supabase Vault.';
comment on table public.calendar_oauth_states is
  'Estados OAuth e PKCE de uso unico, acessiveis apenas pelo backend service_role.';
comment on column public.calendar_integrations.sync_token is
  'Cursor opaco do Google Calendar usado somente pelas Edge Functions.';
comment on column public.calendar_integrations.watch_token_hash is
  'SHA-256 do token do canal; o valor original nao e persistido.';

notify pgrst, 'reload schema';
