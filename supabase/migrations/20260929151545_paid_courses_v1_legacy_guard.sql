alter table public.courses
  drop constraint if exists courses_paid_content_must_be_protected,
  add constraint courses_paid_content_must_be_protected check (
    is_paid is false
    or lessons is null
    or lessons = '[]'::jsonb
  );
