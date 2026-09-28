-- ADPEL Digital - app_notifications como fonte central de notificacoes.
-- Webhook assincrono: app_notifications -> pg_net -> send-user-notification.

create extension if not exists pg_net with schema extensions;

-- O catalogo de tipos permanece extensivel para lembretes e automacoes futuras.
alter table public.app_notifications
  drop constraint if exists app_notifications_type_check;

alter table public.app_notifications
  add constraint app_notifications_type_format_check
    check (type ~ '^[a-z][a-z0-9_]{1,63}$'),
  add constraint app_notifications_title_length_check
    check (char_length(title) between 1 and 120),
  add constraint app_notifications_body_length_check
    check (body is null or char_length(body) <= 1000),
  add constraint app_notifications_entity_type_length_check
    check (entity_type is null or char_length(entity_type) <= 64),
  add constraint app_notifications_url_check
    check (
      url is null
      or (
        char_length(url) <= 512
        and (url like '/%' or url like '#%')
        and url not like '//%'
      )
    );

create index if not exists app_notifications_actor_id_idx
  on public.app_notifications(actor_id)
  where actor_id is not null;

-- O cliente le somente suas notificacoes e altera somente read_at.
revoke all on table public.app_notifications from anon, authenticated;
grant select on table public.app_notifications to authenticated;
grant update (read_at) on table public.app_notifications to authenticated;

drop policy if exists notifications_select_own on public.app_notifications;
drop policy if exists notifications_update_own on public.app_notifications;
drop policy if exists notifications_delete_own on public.app_notifications;

create policy notifications_select_own
  on public.app_notifications
  for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

create policy notifications_update_read_at_own
  on public.app_notifications
  for update
  to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

-- Cada endpoint pertence obrigatoriamente a um usuario, mantendo multiplos
-- dispositivos por conta e um unico dono por endpoint.
alter table public.push_subscriptions
  alter column user_id set not null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_user_id_fkey;

alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select_own_or_master on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own_or_master on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own_or_master on public.push_subscriptions;

create policy push_subscriptions_select_own
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_update_own
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_delete_own
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Realtime usa a mesma RLS de leitura e filtra recipient_id no cliente.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end;
$$;

-- O segredo e gerado no banco e permanece criptografado no Vault. Ele nao e
-- incluido no repositorio, no payload ou nos logs da Edge Function.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'adpel_notification_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'adpel_notification_webhook_secret',
      'Autentica o webhook app_notifications -> send-user-notification'
    );
  end if;
end;
$$;

create or replace function public.verify_notification_webhook_secret(
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
      where secret_row.name = 'adpel_notification_webhook_secret'
        and secret_row.decrypted_secret = provided_secret
    );
$$;

revoke all on function public.verify_notification_webhook_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_notification_webhook_secret(text)
  to service_role;

create or replace function public.dispatch_app_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  webhook_secret text;
begin
  select secret_row.decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets secret_row
  where secret_row.name = 'adpel_notification_webhook_secret';

  if webhook_secret is null then
    raise warning 'Webhook de app_notifications sem segredo configurado.';
    return new;
  end if;

  perform net.http_post(
    url := 'https://piqlrjzlepcpqootpyvq.supabase.co/functions/v1/send-user-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-adpel-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'public',
      'table', 'app_notifications',
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- A notificacao interna nunca falha por indisponibilidade do push.
    raise warning 'Falha ao enfileirar push de app_notifications (SQLSTATE %).', sqlstate;
    return new;
end;
$$;

revoke all on function public.dispatch_app_notification_webhook()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_dispatch_app_notification_push
  on public.app_notifications;

create trigger trg_dispatch_app_notification_push
after insert on public.app_notifications
for each row
execute function public.dispatch_app_notification_webhook();

comment on function public.dispatch_app_notification_webhook() is
  'Database Webhook assincrono; a Edge Function usa somente o ID e relê a app_notification canônica.';

notify pgrst, 'reload schema';
