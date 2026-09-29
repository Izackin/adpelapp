drop policy if exists course_content_read_authorized on public.course_content;
drop policy if exists course_content_read_anon_free on public.course_content;
drop policy if exists course_content_read_authenticated on public.course_content;

create policy course_content_read_anon_free
on public.course_content
for select
to anon
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_content.course_id
      and c.is_published is true
      and c.is_paid is false
  )
);

create policy course_content_read_authenticated
on public.course_content
for select
to authenticated
using (
  (select public.is_admin_master())
  or exists (
    select 1
    from public.courses c
    where c.id = course_content.course_id
      and c.is_published is true
      and (
        c.is_paid is false
        or exists (
          select 1
          from public.course_access ca
          where ca.course_id = course_content.course_id
            and ca.user_id = (select auth.uid())
            and ca.status = 'active'
        )
      )
  )
);
