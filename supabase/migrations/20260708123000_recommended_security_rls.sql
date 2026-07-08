-- ADPEL Digital - RLS recomendado para seguranca basica.
-- Revise em ambiente de teste antes de aplicar em producao.

create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'master'
  );
$$;

alter table public.profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "profiles_select_self_or_public" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self_or_master" on public.profiles;
drop policy if exists "profiles_delete_master" on public.profiles;

create policy "profiles_select_self_or_public"
  on public.profiles for select
  using (
    id = auth.uid()
    or coalesce(show_public_profile, true) = true
    or public.is_admin_master()
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_self_or_master"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin_master())
  with check (id = auth.uid() or public.is_admin_master());

create policy "profiles_delete_master"
  on public.profiles for delete
  using (public.is_admin_master());

drop policy if exists "community_posts_select_published" on public.community_posts;
drop policy if exists "community_posts_insert_own" on public.community_posts;
drop policy if exists "community_posts_update_own_or_admin" on public.community_posts;
drop policy if exists "community_posts_delete_own_or_master" on public.community_posts;

create policy "community_posts_select_published"
  on public.community_posts for select to authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_admin_master());

create policy "community_posts_insert_own"
  on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and status = 'published');

create policy "community_posts_update_own_or_admin"
  on public.community_posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin_master())
  with check (user_id = auth.uid() or public.is_admin_master());

create policy "community_posts_delete_own_or_master"
  on public.community_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_master());

drop policy if exists "community_comments_select_published" on public.community_comments;
drop policy if exists "community_comments_insert_own" on public.community_comments;
drop policy if exists "community_comments_update_own_or_admin" on public.community_comments;
drop policy if exists "community_comments_delete_own_or_master" on public.community_comments;

create policy "community_comments_select_published"
  on public.community_comments for select to authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_admin_master());

create policy "community_comments_insert_own"
  on public.community_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.status = 'published'
    )
  );

create policy "community_comments_update_own_or_admin"
  on public.community_comments for update to authenticated
  using (user_id = auth.uid() or public.is_admin_master())
  with check (user_id = auth.uid() or public.is_admin_master());

create policy "community_comments_delete_own_or_master"
  on public.community_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_master());

drop policy if exists "community_reactions_select" on public.community_reactions;
drop policy if exists "community_reactions_insert_own" on public.community_reactions;
drop policy if exists "community_reactions_delete_own" on public.community_reactions;

create policy "community_reactions_select"
  on public.community_reactions for select to authenticated
  using (true);

create policy "community_reactions_insert_own"
  on public.community_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.status = 'published'
    )
  );

create policy "community_reactions_delete_own"
  on public.community_reactions for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_master());

drop policy if exists "Push subs - leitura publica" on public.push_subscriptions;
drop policy if exists "Push subs - insercao autenticada" on public.push_subscriptions;
drop policy if exists "Push subs - exclusao propria" on public.push_subscriptions;
drop policy if exists "push_subscriptions_select_own_or_master" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own_or_master" on public.push_subscriptions;

create policy "push_subscriptions_select_own_or_master"
  on public.push_subscriptions for select
  using (user_id = auth.uid() or public.is_admin_master());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (user_id = auth.uid() or public.is_admin_master())
  with check (user_id = auth.uid() or public.is_admin_master());

create policy "push_subscriptions_delete_own_or_master"
  on public.push_subscriptions for delete
  using (user_id = auth.uid() or public.is_admin_master());

drop policy if exists "community_media_public_read" on storage.objects;
drop policy if exists "community_media_user_insert" on storage.objects;
drop policy if exists "community_media_user_update" on storage.objects;
drop policy if exists "community_media_user_delete" on storage.objects;

create policy "community_media_public_read"
  on storage.objects for select
  using (bucket_id = 'community-media');

create policy "community_media_user_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and split_part(name, '/', 1) = auth.uid()::text
    and lower(right(name, 5)) not in ('.html', '.xhtml')
    and lower(split_part(name, '.', array_length(string_to_array(name, '.'), 1))) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "community_media_user_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-media'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin_master())
  )
  with check (
    bucket_id = 'community-media'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin_master())
  );

create policy "community_media_user_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-media'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin_master())
  );

notify pgrst, 'reload schema';
