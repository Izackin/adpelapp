-- Read-only regression: no users, posts, courses or payments are created.
DO $test$
DECLARE
  test_uid uuid := gen_random_uuid();
  real_uid uuid;
  expected_progress bigint;
  visible_progress bigint;
  expected_posts bigint;
  visible_posts bigint;
  visible_profiles bigint;
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='user_lesson_progress'
      AND permissive='RESTRICTIVE' AND policyname IN (
        'user_lesson_progress_paid_course_insert_guard',
        'user_lesson_progress_paid_course_update_guard',
        'user_lesson_progress_paid_course_delete_guard'
      )) <> 3 THEN
    RAISE EXCEPTION 'Paid-course guards changed';
  END IF;
  SELECT count(*) INTO expected_posts FROM public.community_posts WHERE status='published';
  SELECT p.id INTO real_uid FROM public.profiles p
    WHERE p.role IS DISTINCT FROM 'master'
      AND EXISTS (SELECT 1 FROM public.user_lesson_progress l WHERE l.user_id=p.id)
    ORDER BY p.id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=test_uid)
     OR EXISTS (SELECT 1 FROM public.user_lesson_progress WHERE user_id=test_uid) THEN
    RAISE EXCEPTION 'Simulated identity collision';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',test_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',test_uid,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_progress FROM public.user_lesson_progress;
  SELECT count(*) INTO visible_posts FROM public.community_posts;
  SELECT count(*) INTO visible_profiles FROM public.profiles;
  IF visible_progress <> 0 OR visible_profiles <> 0 OR visible_posts <> expected_posts OR public.is_admin_master() THEN
    RAISE EXCEPTION 'Non-owner access regression';
  END IF;
  EXECUTE 'RESET ROLE';
  IF real_uid IS NOT NULL THEN
    SELECT count(*) INTO expected_progress FROM public.user_lesson_progress WHERE user_id=real_uid;
    PERFORM set_config('request.jwt.claim.sub',real_uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',real_uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO visible_progress FROM public.user_lesson_progress;
    SELECT count(*) INTO visible_profiles FROM public.profiles;
    IF visible_progress <> expected_progress OR visible_profiles <> 1 OR public.is_admin_master() THEN
      RAISE EXCEPTION 'Owner access regression';
    END IF;
    EXECUTE 'RESET ROLE';
  ELSE
    RAISE NOTICE 'Owner test skipped: no non-master user with lesson progress';
  END IF;
END
$test$;
SELECT 'database performance access regression: PASS' AS result;
