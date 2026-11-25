-- Read-only regression for privacy-safe public projections.
DO $test$
DECLARE
  expected_rank bigint;
  expected_events bigint;
  expected_total bigint;
  actual_rank bigint;
  actual_events bigint;
  actual_total bigint;
  own_count bigint;
  own_expected bigint;
  test_uid uuid := gen_random_uuid();
  attendee_uid uuid;
  columns text[];
BEGIN
  SELECT array_agg(column_name::text ORDER BY ordinal_position) INTO columns
  FROM information_schema.columns WHERE table_schema='public' AND table_name='public_spiritual_ranking';
  IF columns IS DISTINCT FROM ARRAY['user_id','user_name','avatar_url','xp','total_points','streak_days']::text[] THEN
    RAISE EXCEPTION 'Ranking projection exposes unexpected columns';
  END IF;
  SELECT array_agg(column_name::text ORDER BY ordinal_position) INTO columns
  FROM information_schema.columns WHERE table_schema='public' AND table_name='public_event_attendance_summary';
  IF columns IS DISTINCT FROM ARRAY['event_id','confirmed_count','has_confirmed']::text[] THEN
    RAISE EXCEPTION 'Attendance projection exposes unexpected columns';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('public_spiritual_ranking','public_event_attendance_summary')
    AND NOT (coalesce(c.reloptions,ARRAY[]::text[]) @> ARRAY['security_invoker=true','security_barrier=true'])) THEN
    RAISE EXCEPTION 'Missing safe view settings';
  END IF;
  SELECT count(*) INTO expected_rank FROM public.spiritual_progress s JOIN public.profiles p ON p.id=s.user_id
    WHERE p.show_public_profile IS NOT FALSE AND p.show_in_ranking IS NOT FALSE;
  SELECT count(*) INTO expected_events FROM public.events WHERE is_published IS TRUE AND is_active IS TRUE;
  SELECT count(*) INTO expected_total FROM public.event_attendances a JOIN public.events e ON e.id=a.event_id
    WHERE e.is_published IS TRUE AND e.is_active IS TRUE;
  SELECT a.user_id INTO attendee_uid FROM public.event_attendances a JOIN public.events e ON e.id=a.event_id
    WHERE a.user_id IS NOT NULL AND e.is_published IS TRUE AND e.is_active IS TRUE ORDER BY a.id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=test_uid) OR
    EXISTS (SELECT 1 FROM public.event_attendances WHERE user_id=test_uid) THEN
    RAISE EXCEPTION 'Test identity collision';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO actual_rank FROM public.public_spiritual_ranking;
  SELECT count(*), coalesce(sum(confirmed_count),0), count(*) FILTER (WHERE has_confirmed)
    INTO actual_events, actual_total, own_count FROM public.public_event_attendance_summary;
  IF actual_rank<>expected_rank OR actual_events<>expected_events OR actual_total<>expected_total OR own_count<>0 THEN
    RAISE EXCEPTION 'Anonymous projection regression';
  END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',test_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',test_uid,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_rank FROM public.public_spiritual_ranking;
  SELECT count(*), coalesce(sum(confirmed_count),0), count(*) FILTER (WHERE has_confirmed)
    INTO actual_events, actual_total, own_count FROM public.public_event_attendance_summary;
  IF actual_rank<>expected_rank OR actual_events<>expected_events OR actual_total<>expected_total OR own_count<>0 THEN
    RAISE EXCEPTION 'Authenticated nonattendee projection regression';
  END IF;
  EXECUTE 'RESET ROLE';
  IF attendee_uid IS NOT NULL THEN
    SELECT count(DISTINCT a.event_id) INTO own_expected FROM public.event_attendances a JOIN public.events e ON e.id=a.event_id
      WHERE a.user_id=attendee_uid AND e.is_published IS TRUE AND e.is_active IS TRUE;
    PERFORM set_config('request.jwt.claim.sub',attendee_uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',attendee_uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*), coalesce(sum(confirmed_count),0), count(*) FILTER (WHERE has_confirmed)
      INTO actual_events, actual_total, own_count FROM public.public_event_attendance_summary;
    IF actual_events<>expected_events OR actual_total<>expected_total OR own_count<>own_expected THEN
      RAISE EXCEPTION 'Attendee status regression';
    END IF;
    EXECUTE 'RESET ROLE';
  END IF;
END
$test$;
SELECT 'privacy projections regression: PASS' AS result;
