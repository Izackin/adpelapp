-- ADPEL Digital - Push, avatar de perfil e permissao de publicacoes.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'master@adpel.com'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master'
    );
$$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Push subs - leitura publica" on public.push_subscriptions;
drop policy if exists "Push subs - insercao autenticada" on public.push_subscriptions;
drop policy if exists "Push subs - exclusao propria" on public.push_subscriptions;
drop policy if exists "push_subscriptions_select_own_or_master" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own_or_visitor" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own_or_visitor" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own_or_master" on public.push_subscriptions;

create policy "push_subscriptions_select_own_or_master"
  on public.push_subscriptions for select
  using (
    auth.uid() = user_id
    or public.is_admin_master()
  );

create policy "push_subscriptions_insert_own_or_visitor"
  on public.push_subscriptions for insert
  with check (
    user_id is null
    or auth.uid() = user_id
  );

create policy "push_subscriptions_update_own_or_visitor"
  on public.push_subscriptions for update
  using (
    user_id is null
    or auth.uid() = user_id
    or public.is_admin_master()
  )
  with check (
    user_id is null
    or auth.uid() = user_id
    or public.is_admin_master()
  );

create policy "push_subscriptions_delete_own_or_master"
  on public.push_subscriptions for delete
  using (
    auth.uid() = user_id
    or public.is_admin_master()
  );

drop policy if exists "community_posts_delete_own_or_master" on public.community_posts;

create policy "community_posts_delete_own_or_master"
  on public.community_posts for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_master()
  );

drop policy if exists "community_posts_update_own_or_admin" on public.community_posts;

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

notify pgrst, 'reload schema';
