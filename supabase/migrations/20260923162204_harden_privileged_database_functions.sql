-- ADPEL Digital - Fase 0, etapa 3.
-- Hardening cirurgico de funcoes internas e do helper canonico de master.
-- Objetos financeiros e views de ofertas permanecem inalterados nesta etapa.

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.handle_new_user()',
    'public.is_admin_master()',
    'public.notify_post_owner_on_amen()',
    'public.notify_post_owner_on_comment()',
    'public.prevent_role_escalation()',
    'public.rls_auto_enable()',
    'public.set_app_updates_updated_at()',
    'public.set_updated_at()',
    'public.update_updated_at()'
  ]
  loop
    if to_regprocedure(function_signature) is null then
      raise exception 'Funcao obrigatoria ausente: %', function_signature;
    end if;
  end loop;
end;
$$;

-- Helper usado por policies RLS. Mantem assinatura, SECURITY DEFINER e
-- comportamento; remove o grant implicito a PUBLIC e preserva somente os
-- papeis que precisam avaliar as policies ou operar pelo backend.
alter function public.is_admin_master()
  set search_path = pg_catalog;

revoke all privileges on function public.is_admin_master()
  from public, anon, authenticated;
grant execute on function public.is_admin_master()
  to anon, authenticated, service_role;

comment on function public.is_admin_master() is
  'Helper SECURITY DEFINER de autorizacao master; execucao direta permanece apenas para papeis exigidos pelas policies.';

-- Funcoes SECURITY DEFINER invocadas exclusivamente por triggers/event trigger.
-- Os objetos consultados por elas ja usam qualificacao explicita de schema.
alter function public.handle_new_user()
  set search_path = pg_catalog;
alter function public.notify_post_owner_on_amen()
  set search_path = pg_catalog;
alter function public.notify_post_owner_on_comment()
  set search_path = pg_catalog;

-- Esta funcao so manipula NEW/OLD e nao precisa de privilegios do owner.
-- Como ela consulta current_user, SECURITY INVOKER e necessario para que a
-- verificacao observe o papel chamador em vez do owner postgres.
alter function public.prevent_role_escalation()
  security invoker;
alter function public.prevent_role_escalation()
  set search_path = pg_catalog;
alter function public.rls_auto_enable()
  set search_path = pg_catalog;

revoke all privileges on function public.handle_new_user()
  from public, anon, authenticated;
revoke all privileges on function public.notify_post_owner_on_amen()
  from public, anon, authenticated;
revoke all privileges on function public.notify_post_owner_on_comment()
  from public, anon, authenticated;
revoke all privileges on function public.prevent_role_escalation()
  from public, anon, authenticated;
revoke all privileges on function public.rls_auto_enable()
  from public, anon, authenticated;

grant execute on function public.handle_new_user() to service_role;
grant execute on function public.notify_post_owner_on_amen() to service_role;
grant execute on function public.notify_post_owner_on_comment() to service_role;
grant execute on function public.prevent_role_escalation() to service_role;
grant execute on function public.rls_auto_enable() to service_role;

comment on function public.handle_new_user() is
  'Funcao interna do trigger auth.users -> profiles; nao e RPC publica.';
comment on function public.notify_post_owner_on_amen() is
  'Funcao interna do trigger de reacoes da comunidade; nao e RPC publica.';
comment on function public.notify_post_owner_on_comment() is
  'Funcao interna do trigger de comentarios da comunidade; nao e RPC publica.';
comment on function public.prevent_role_escalation() is
  'Funcao SECURITY INVOKER interna que impede promocao de role; nao e RPC publica.';
comment on function public.rls_auto_enable() is
  'Funcao interna de event trigger para habilitar RLS em novas tabelas public.';

-- Helpers de timestamp sao SECURITY INVOKER e nao acessam tabelas. Um
-- search_path minimo elimina resolucao mutavel sem alterar o contrato.
alter function public.set_app_updates_updated_at()
  set search_path = pg_catalog;
alter function public.set_updated_at()
  set search_path = pg_catalog;
alter function public.update_updated_at()
  set search_path = pg_catalog;

revoke all privileges on function public.set_app_updates_updated_at()
  from public, anon, authenticated;
revoke all privileges on function public.set_updated_at()
  from public, anon, authenticated;
revoke all privileges on function public.update_updated_at()
  from public, anon, authenticated;

grant execute on function public.set_app_updates_updated_at() to service_role;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.update_updated_at() to service_role;

comment on function public.set_app_updates_updated_at() is
  'Funcao interna de trigger para updated_at; nao e RPC publica.';
comment on function public.set_updated_at() is
  'Funcao interna compartilhada de trigger para updated_at; nao e RPC publica.';
comment on function public.update_updated_at() is
  'Funcao interna legada de trigger para updated_at; nao e RPC publica.';

notify pgrst, 'reload schema';
