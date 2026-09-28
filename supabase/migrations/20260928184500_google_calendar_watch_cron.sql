-- Renova canais Google Calendar antes da expiracao.
-- O segredo e gerado no Vault e nunca e exposto ao frontend ou ao repositorio.

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'adpel_google_calendar_cron_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'adpel_google_calendar_cron_secret',
      'Autentica o Cron de renovacao dos canais Google Calendar'
    );
  end if;
end;
$$;

create or replace function public.verify_google_calendar_cron_secret(
  provided_secret text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    provided_secret is not null
    and char_length(provided_secret) between 32 and 256
    and exists (
      select 1
      from vault.decrypted_secrets secret_row
      where secret_row.name = 'adpel_google_calendar_cron_secret'
        and secret_row.decrypted_secret = provided_secret
    );
$$;

revoke all privileges on function public.verify_google_calendar_cron_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_google_calendar_cron_secret(text)
  to service_role;

create or replace function public.dispatch_google_calendar_watch_renewal()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cron_secret text;
begin
  select secret_row.decrypted_secret
    into cron_secret
  from vault.decrypted_secrets secret_row
  where secret_row.name = 'adpel_google_calendar_cron_secret';

  if cron_secret is null then
    raise warning 'Cron do Google Calendar sem segredo configurado.';
    return;
  end if;

  perform net.http_post(
    url := 'https://piqlrjzlepcpqootpyvq.supabase.co/functions/v1/google-calendar-renew-watches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-adpel-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
exception
  when others then
    raise warning 'Falha ao enfileirar renovacao Google Calendar (SQLSTATE %).', sqlstate;
end;
$$;

revoke all privileges on function public.dispatch_google_calendar_watch_renewal()
  from public, anon, authenticated;
grant execute on function public.dispatch_google_calendar_watch_renewal()
  to service_role;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'adpel-google-calendar-watch-renewal'
  ) then
    perform cron.schedule(
      'adpel-google-calendar-watch-renewal',
      '0 */6 * * *',
      'select public.dispatch_google_calendar_watch_renewal();'
    );
  end if;
end;
$$;

comment on function public.dispatch_google_calendar_watch_renewal() is
  'Cron interno que solicita renovacao dos canais Google Calendar a cada seis horas.';

notify pgrst, 'reload schema';
