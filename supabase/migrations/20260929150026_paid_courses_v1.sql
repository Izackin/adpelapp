alter table public.courses
  add column if not exists is_paid boolean not null default false,
  add column if not exists price_cents integer not null default 0,
  add column if not exists lesson_count integer not null default 0;

alter table public.courses
  drop constraint if exists courses_price_cents_nonnegative,
  add constraint courses_price_cents_nonnegative check (price_cents >= 0),
  drop constraint if exists courses_lesson_count_nonnegative,
  add constraint courses_lesson_count_nonnegative check (lesson_count >= 0),
  drop constraint if exists courses_paid_price_consistency,
  add constraint courses_paid_price_consistency check (
    (is_paid = false and price_cents = 0)
    or (is_paid = true and price_cents > 0)
  );

update public.courses
set lesson_count = case
  when lessons is not null and jsonb_typeof(lessons) = 'array' then jsonb_array_length(lessons)
  else 0
end;

create table if not exists public.course_content (
  course_id uuid primary key references public.courses(id) on delete cascade,
  lessons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_content_lessons_array check (jsonb_typeof(lessons) = 'array')
);

insert into public.course_content (course_id, lessons)
select
  id,
  case
    when lessons is not null and jsonb_typeof(lessons) = 'array' then lessons
    else '[]'::jsonb
  end
from public.courses
on conflict (course_id) do update
set lessons = excluded.lessons,
    updated_at = now();

create table if not exists public.course_access (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'revoked')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  access_source text not null default 'manual_request',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint course_access_course_user_unique unique (course_id, user_id)
);

create index if not exists course_access_user_status_idx
  on public.course_access(user_id, status);

create index if not exists course_access_course_status_idx
  on public.course_access(course_id, status);

alter table public.course_content enable row level security;
alter table public.course_access enable row level security;

revoke all on table public.course_content from anon, authenticated;
grant select on table public.course_content to anon, authenticated;
grant insert, update, delete on table public.course_content to authenticated;

revoke all on table public.course_access from anon, authenticated;
grant select, insert, update on table public.course_access to authenticated;
grant delete on table public.course_access to authenticated;

drop policy if exists course_content_read_authorized on public.course_content;
create policy course_content_read_authorized
on public.course_content
for select
to anon, authenticated
using (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = course_content.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or (
          (select auth.uid()) is not null
          and exists (
            select 1
            from public.course_access ca
            where ca.course_id = course_content.course_id
              and ca.user_id = (select auth.uid())
              and ca.status = 'active'
          )
        )
      )
  )
);

drop policy if exists course_content_master_insert on public.course_content;
create policy course_content_master_insert
on public.course_content
for insert
to authenticated
with check ((select public.is_admin_master()));

drop policy if exists course_content_master_update on public.course_content;
create policy course_content_master_update
on public.course_content
for update
to authenticated
using ((select public.is_admin_master()))
with check ((select public.is_admin_master()));

drop policy if exists course_content_master_delete on public.course_content;
create policy course_content_master_delete
on public.course_content
for delete
to authenticated
using ((select public.is_admin_master()));

drop policy if exists course_access_select_own_or_master on public.course_access;
create policy course_access_select_own_or_master
on public.course_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin_master())
);

drop policy if exists course_access_insert_pending_own on public.course_access;
create policy course_access_insert_pending_own
on public.course_access
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and access_source = 'manual_request'
  and approved_at is null
  and approved_by is null
  and exists (
    select 1
    from public.courses c
    where c.id = course_access.course_id
      and c.is_published is true
      and c.is_paid is true
      and c.price_cents = course_access.amount_cents
  )
);

drop policy if exists course_access_retry_own on public.course_access;
create policy course_access_retry_own
on public.course_access
for update
to authenticated
using (
  user_id = (select auth.uid())
  and status in ('rejected', 'revoked')
)
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and access_source = 'manual_request'
  and approved_at is null
  and approved_by is null
  and exists (
    select 1
    from public.courses c
    where c.id = course_access.course_id
      and c.is_published is true
      and c.is_paid is true
      and c.price_cents = course_access.amount_cents
  )
);

drop policy if exists course_access_master_insert on public.course_access;
create policy course_access_master_insert
on public.course_access
for insert
to authenticated
with check ((select public.is_admin_master()));

drop policy if exists course_access_master_update on public.course_access;
create policy course_access_master_update
on public.course_access
for update
to authenticated
using ((select public.is_admin_master()))
with check ((select public.is_admin_master()));

drop policy if exists course_access_master_delete on public.course_access;
create policy course_access_master_delete
on public.course_access
for delete
to authenticated
using ((select public.is_admin_master()));
