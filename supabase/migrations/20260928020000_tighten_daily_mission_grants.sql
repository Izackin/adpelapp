-- Finaliza o hardening da jornada diaria depois da migracao principal.
-- As tabelas permanecem legiveis conforme a experiencia atual, mas nenhuma
-- operacao de escrita/DDL fica disponivel diretamente para clientes anonimos
-- ou autenticados. Toda mutacao passa pelas RPCs SECURITY DEFINER validadas.

revoke all on table public.spiritual_progress from anon, authenticated;
revoke all on table public.daily_challenges from anon, authenticated;
revoke all on table public.user_daily_challenges from anon, authenticated;

grant select on table public.spiritual_progress to anon, authenticated;
grant select on table public.daily_challenges to anon, authenticated;
grant select on table public.user_daily_challenges to authenticated;

-- Remove policies redundantes que geravam multiplas avaliacoes por consulta.
drop policy if exists adpel_daily_challenges_authenticated_read
on public.daily_challenges;

drop policy if exists "Usuario le proprios desafios"
on public.user_daily_challenges;

drop policy if exists "Usuário lê próprios desafios"
on public.user_daily_challenges;

drop policy if exists adpel_user_daily_challenges_select_own
on public.user_daily_challenges;

drop policy if exists journey_user_daily_challenges_select_own
on public.user_daily_challenges;

create policy journey_user_daily_challenges_select_own
on public.user_daily_challenges
for select
to authenticated
using ((select auth.uid()) = user_id);

-- O ranking publico ja cobre a leitura desta tabela; a policy por dono era
-- redundante e nao adicionava protecao enquanto a policy publica estivesse ativa.
drop policy if exists "Own Progress Select"
on public.spiritual_progress;

notify pgrst, 'reload schema';
