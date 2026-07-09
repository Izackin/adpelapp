-- ADPEL Digital - Endurecimento de RLS para publicacoes da Comunidade ADPEL.
-- Mantem remocao logica via status = 'removed' e restringe updates publicos
-- aos campos usados pela moderacao/remocao: status e updated_at.

alter table public.community_posts enable row level security;

drop policy if exists "community_posts_select_published" on public.community_posts;
drop policy if exists "community_posts_insert_own" on public.community_posts;
drop policy if exists "community_posts_update_own_or_admin" on public.community_posts;
drop policy if exists "community_posts_delete_own_or_master" on public.community_posts;

create policy "community_posts_select_published"
  on public.community_posts for select to authenticated
  using (
    status = 'published'
    or public.is_admin_master()
  );

create policy "community_posts_insert_own"
  on public.community_posts for insert to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and status = 'published'
  );

create policy "community_posts_update_own_or_admin"
  on public.community_posts for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_master()
  )
  with check (
    user_id = auth.uid()
    or public.is_admin_master()
  );

create policy "community_posts_delete_own_or_master"
  on public.community_posts for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_master()
  );

-- RLS decide quais linhas podem ser alteradas; os GRANTs abaixo limitam quais
-- colunas o cliente autenticado consegue atualizar pelo PostgREST/Supabase.
revoke update on public.community_posts from anon, authenticated;
grant update (status, updated_at) on public.community_posts to authenticated;

notify pgrst, 'reload schema';
