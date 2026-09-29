drop policy if exists user_lesson_progress_paid_course_insert_guard on public.user_lesson_progress;
create policy user_lesson_progress_paid_course_insert_guard
on public.user_lesson_progress
as restrictive
for insert
to authenticated
with check (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = user_lesson_progress.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = user_lesson_progress.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
);

drop policy if exists user_lesson_progress_paid_course_update_guard on public.user_lesson_progress;
create policy user_lesson_progress_paid_course_update_guard
on public.user_lesson_progress
as restrictive
for update
to authenticated
using (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = user_lesson_progress.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = user_lesson_progress.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
)
with check (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = user_lesson_progress.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = user_lesson_progress.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
);

drop policy if exists user_lesson_progress_paid_course_delete_guard on public.user_lesson_progress;
create policy user_lesson_progress_paid_course_delete_guard
on public.user_lesson_progress
as restrictive
for delete
to authenticated
using (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = user_lesson_progress.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = user_lesson_progress.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
);

drop policy if exists certificates_paid_course_insert_guard on public.certificates;
create policy certificates_paid_course_insert_guard
on public.certificates
as restrictive
for insert
to authenticated
with check (
  (select public.is_admin_master())
  or course_id is null
  or exists (
    select 1
    from public.courses c
    where c.id = certificates.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = certificates.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
);
