-- Roll back every fixture; do not call dispatch or insert any notification.
DO $test$
DECLARE
  uid uuid;
  stranger uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  e3 uuid := gen_random_uuid();
  simulated_now timestamptz := '2040-02-15 10:00:00-03';
  n bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='adpel-event-reminders-v1' AND active IS FALSE) THEN
    RAISE EXCEPTION 'Scheduler must remain disabled during homologation';
  END IF;
  IF has_table_privilege('anon','public.event_reminder_preferences','SELECT')
     OR has_function_privilege('authenticated','adpel_private.dispatch_event_reminders()','EXECUTE')
     OR has_function_privilege('anon','adpel_private.plan_event_reminders(timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected public privileges';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='app_notifications_event_reminder_once_idx' AND i.indisunique AND i.indisvalid) THEN
    RAISE EXCEPTION 'Missing deduplication index';
  END IF;
  SELECT id INTO uid FROM auth.users ORDER BY id LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'No test account available'; END IF;
  BEGIN
    INSERT INTO public.events(id,title,event_date,is_active,is_published)
      VALUES(e1,'TESTE INTERNO',date '2040-02-16',true,true),
            (e2,'TESTE INTERNO',date '2040-02-16',true,true),
            (e3,'TESTE INTERNO',date '2040-02-16',true,true);
    INSERT INTO public.event_attendances(event_id,user_id) VALUES(e1,uid),(e2,uid),(e3,uid);
    INSERT INTO public.event_reminder_preferences(user_id,enabled) VALUES(uid,false)
      ON CONFLICT(user_id) DO UPDATE SET enabled=false;
    SELECT count(*) INTO n FROM adpel_private.plan_event_reminders(simulated_now) WHERE recipient_id=uid;
    IF n<>0 THEN RAISE EXCEPTION 'Opt-out ignored'; END IF;
    UPDATE public.event_reminder_preferences SET enabled=true WHERE user_id=uid;
    SELECT count(*) INTO n FROM adpel_private.plan_event_reminders(simulated_now) WHERE recipient_id=uid AND event_id IN(e1,e2,e3);
    IF n<>2 THEN RAISE EXCEPTION 'Expected daily cap of 2'; END IF;
    SELECT count(*) INTO n FROM adpel_private.plan_event_reminders(simulated_now - interval '3 hours') WHERE recipient_id=uid;
    IF n<>0 THEN RAISE EXCEPTION 'Quiet hours ignored'; END IF;
    SELECT count(*) INTO n FROM adpel_private.plan_event_reminders(simulated_now + interval '1 day') WHERE event_id IN(e1,e2,e3);
    IF n<>0 THEN RAISE EXCEPTION 'Wrong reminder date'; END IF;
    UPDATE public.events SET is_published=false WHERE id=e1;
    DELETE FROM public.event_attendances WHERE event_id=e2 AND user_id=uid;
    SELECT count(*) INTO n FROM adpel_private.plan_event_reminders(simulated_now) WHERE recipient_id=uid AND event_id IN(e1,e2,e3);
    IF n<>1 THEN RAISE EXCEPTION 'Cancelled or unpublished event still selected'; END IF;
    PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.event_reminder_preferences;
    IF n<>0 THEN RAISE EXCEPTION 'Preference isolation failed'; END IF;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub',uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.event_reminder_preferences WHERE enabled IS TRUE;
    IF n<>1 THEN RAISE EXCEPTION 'Owner cannot read own preference'; END IF;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback test fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.events WHERE id IN(e1,e2,e3)) THEN
    RAISE EXCEPTION 'Fixture rollback failed';
  END IF;
END
$test$;
SELECT 'event reminder planner: PASS; no dispatch' AS result;
