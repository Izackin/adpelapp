create index if not exists course_access_approved_by_idx
  on public.course_access(approved_by);

drop policy if exists course_access_insert_pending_own on public.course_access;
drop policy if exists course_access_master_insert on public.course_access;

create policy course_access_insert_allowed
on public.course_access
for insert
to authenticated
with check (
  (select public.is_admin_master())
  or (
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
  )
);

drop policy if exists course_access_retry_own on public.course_access;
drop policy if exists course_access_master_update on public.course_access;

create policy course_access_update_allowed
on public.course_access
for update
to authenticated
using (
  (select public.is_admin_master())
  or (
    user_id = (select auth.uid())
    and status in ('rejected', 'revoked')
  )
)
with check (
  (select public.is_admin_master())
  or (
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
  )
);
