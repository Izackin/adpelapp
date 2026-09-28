-- ============================================================
-- PUSH NOTIFICATIONS - referência segura para novas instalações
-- A evolução versionada está em supabase/migrations/.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;

create policy push_subscriptions_select_own
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_update_own
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
