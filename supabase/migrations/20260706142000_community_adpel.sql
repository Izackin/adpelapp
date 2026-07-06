-- ADPEL - Comunidade ADPEL.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'reflexao',
  image_url text,
  status text not null default 'published',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_category_check check (category in ('testemunho', 'oracao', 'gratidao', 'reflexao', 'comunhao')),
  constraint community_posts_status_check check (status in ('published', 'hidden', 'removed'))
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  constraint community_comments_status_check check (status in ('published', 'hidden', 'removed'))
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reaction_type text not null default 'amen',
  created_at timestamptz not null default now(),
  unique(post_id, user_id, reaction_type)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;

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

drop policy if exists "community_posts_select_published" on public.community_posts;
drop policy if exists "community_posts_insert_own" on public.community_posts;
drop policy if exists "community_posts_update_own_or_admin" on public.community_posts;
drop policy if exists "community_comments_select_published" on public.community_comments;
drop policy if exists "community_comments_insert_own" on public.community_comments;
drop policy if exists "community_comments_update_own_or_admin" on public.community_comments;
drop policy if exists "community_reactions_select" on public.community_reactions;
drop policy if exists "community_reactions_insert_own" on public.community_reactions;
drop policy if exists "community_reactions_delete_own" on public.community_reactions;

create policy "community_posts_select_published"
  on public.community_posts for select to authenticated
  using (status = 'published' or public.is_admin_master());

create policy "community_posts_insert_own"
  on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and status = 'published');

create policy "community_posts_update_own_or_admin"
  on public.community_posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin_master())
  with check (user_id = auth.uid() or public.is_admin_master());

create policy "community_comments_select_published"
  on public.community_comments for select to authenticated
  using (status = 'published' or public.is_admin_master());

create policy "community_comments_insert_own"
  on public.community_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published')
  );

create policy "community_comments_update_own_or_admin"
  on public.community_comments for update to authenticated
  using (user_id = auth.uid() or public.is_admin_master())
  with check (user_id = auth.uid() or public.is_admin_master());

create policy "community_reactions_select"
  on public.community_reactions for select to authenticated
  using (true);

create policy "community_reactions_insert_own"
  on public.community_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published')
  );

create policy "community_reactions_delete_own"
  on public.community_reactions for delete to authenticated
  using (user_id = auth.uid());

create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_comments_post_idx on public.community_comments(post_id, created_at);
create index if not exists community_reactions_post_idx on public.community_reactions(post_id);

notify pgrst, 'reload schema';
