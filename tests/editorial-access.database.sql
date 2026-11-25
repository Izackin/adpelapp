-- Read-only regression for editorial and legacy course permissions.
DO $test$
DECLARE
  t text;
  test_uid uuid := gen_random_uuid();
  master_uid uuid;
  expected_verses bigint;
  visible_verses bigint;
  visible_count bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['verse_of_day','course_modules','course_lessons'] LOOP
    IF has_table_privilege('anon',format('public.%I',t),'INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_table_privilege('authenticated',format('public.%I',t),'TRUNCATE')
       OR NOT has_table_privilege('anon',format('public.%I',t),'SELECT') THEN
      RAISE EXCEPTION 'Unexpected grants for %',t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
        AND (roles::text <> '{authenticated}'
          OR (qual IS NOT NULL AND qual NOT LIKE '%is_admin_master()%')
          OR (with_check IS NOT NULL AND with_check NOT LIKE '%is_admin_master()%')
          OR (cmd IN ('ALL','UPDATE','DELETE') AND qual IS NULL)
          OR (cmd IN ('ALL','INSERT','UPDATE') AND with_check IS NULL))) THEN
      RAISE EXCEPTION 'Unexpected write policy for %',t;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public'
      AND tablename IN ('verse_of_day','course_modules','course_lessons')
      AND cmd IN ('ALL','INSERT','UPDATE','DELETE')) <> 5 THEN
    RAISE EXCEPTION 'Unexpected number of editorial write policies';
  END IF;
  SELECT count(*) INTO expected_verses FROM public.verse_of_day;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=test_uid) THEN RAISE EXCEPTION 'Identity collision'; END IF;
  SELECT id INTO master_uid FROM public.profiles WHERE role='master' ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO visible_verses FROM public.verse_of_day;
  IF visible_verses<>expected_verses OR public.is_admin_master() THEN RAISE EXCEPTION 'Anonymous read regression'; END IF;
  PERFORM 1 FROM public.course_modules LIMIT 1;
  PERFORM 1 FROM public.course_lessons LIMIT 1;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',test_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',test_uid,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_verses FROM public.verse_of_day;
  IF visible_verses<>expected_verses OR public.is_admin_master() THEN RAISE EXCEPTION 'Ordinary user read regression'; END IF;
  SELECT count(*) INTO visible_count FROM public.course_modules m JOIN public.courses c ON c.id=m.course_id WHERE c.is_paid IS TRUE;
  IF visible_count<>0 THEN RAISE EXCEPTION 'Unentitled paid modules visible'; END IF;
  PERFORM 1 FROM public.course_lessons LIMIT 1;
  EXECUTE 'RESET ROLE';
  IF master_uid IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub',master_uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF NOT public.is_admin_master() THEN RAISE EXCEPTION 'Master identity regression'; END IF;
    PERFORM 1 FROM public.verse_of_day LIMIT 1;
    PERFORM 1 FROM public.course_modules LIMIT 1;
    PERFORM 1 FROM public.course_lessons LIMIT 1;
    EXECUTE 'RESET ROLE';
  END IF;
END
$test$;
SELECT 'editorial access regression: PASS' AS result;
