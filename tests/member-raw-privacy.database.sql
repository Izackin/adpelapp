-- Read-only regression: production data is neither printed nor changed.
DO $test$
DECLARE
  t text;
  owner_uid uuid;
  master_uid uuid;
  stranger_uid uuid := gen_random_uuid();
  expected_count bigint;
  actual_count bigint;
  expected_rank bigint;
  expected_attendance bigint;
  actual_rank bigint;
  actual_attendance bigint;
  own_status bigint;
BEGIN
  SELECT count(*) INTO expected_rank FROM public.spiritual_progress s
    JOIN public.profiles p ON p.id=s.user_id
    WHERE p.show_public_profile IS NOT FALSE AND p.show_in_ranking IS NOT FALSE;
  SELECT count(*) INTO expected_attendance FROM public.event_attendances a
    JOIN public.events e ON e.id=a.event_id WHERE e.is_published IS TRUE AND e.is_active IS TRUE;
  SELECT id INTO master_uid FROM public.profiles WHERE role='master' ORDER BY id LIMIT 1;
  FOREACH t IN ARRAY ARRAY['event_attendances','spiritual_progress'] LOOP
    IF has_table_privilege('anon',format('public.%I',t),'SELECT')
       OR NOT has_table_privilege('authenticated',format('public.%I',t),'SELECT') THEN
      RAISE EXCEPTION 'Unexpected raw table grants for %',t;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id=$1',t) INTO expected_count USING stranger_uid;
    IF expected_count<>0 THEN RAISE EXCEPTION 'Test identity collision'; END IF;
    PERFORM set_config('request.jwt.claim.sub',stranger_uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger_uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE format('SELECT count(*) FROM public.%I',t) INTO actual_count;
    IF actual_count<>0 OR public.is_admin_master() THEN RAISE EXCEPTION 'Unauthorized visibility in %',t; END IF;
    EXECUTE 'RESET ROLE';
    EXECUTE format('SELECT t.user_id FROM public.%I t JOIN public.profiles p ON p.id=t.user_id WHERE p.role IS DISTINCT FROM ''master'' ORDER BY t.user_id LIMIT 1',t) INTO owner_uid;
    IF owner_uid IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id=$1',t) INTO expected_count USING owner_uid;
      PERFORM set_config('request.jwt.claim.sub',owner_uid::text,true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_uid,'role','authenticated')::text,true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE format('SELECT count(*) FROM public.%I',t) INTO actual_count;
      IF actual_count<>expected_count OR public.is_admin_master() THEN RAISE EXCEPTION 'Owner visibility regression in %',t; END IF;
      EXECUTE 'RESET ROLE';
    ELSE RAISE NOTICE 'No non-master owner fixture for %',t;
    END IF;
    IF master_uid IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I',t) INTO expected_count;
      PERFORM set_config('request.jwt.claim.sub',master_uid::text,true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_uid,'role','authenticated')::text,true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE format('SELECT count(*) FROM public.%I',t) INTO actual_count;
      IF actual_count<>expected_count OR NOT public.is_admin_master() THEN RAISE EXCEPTION 'Master visibility regression in %',t; END IF;
      EXECUTE 'RESET ROLE';
    END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO actual_rank FROM public.public_spiritual_ranking;
  SELECT coalesce(sum(confirmed_count),0),count(*) FILTER (WHERE has_confirmed)
    INTO actual_attendance,own_status FROM public.public_event_attendance_summary;
  IF actual_rank<>expected_rank OR actual_attendance<>expected_attendance OR own_status<>0 THEN
    RAISE EXCEPTION 'Public projection regression';
  END IF;
  EXECUTE 'RESET ROLE';
END
$test$;
SELECT 'member raw-table privacy regression: PASS' AS result;
