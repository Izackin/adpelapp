-- Simulate only eligibility; no notification inserts or external dispatch.
DO $test$
DECLARE uid uuid; stranger uuid:=gen_random_uuid(); n bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='adpel-birthday-greetings-v1' AND active IS FALSE) THEN RAISE EXCEPTION 'Job not disabled'; END IF;
  IF has_table_privilege('anon','public.birthday_reminder_preferences','SELECT') OR has_function_privilege('authenticated','adpel_private.dispatch_birthday_greetings()','EXECUTE') THEN RAISE EXCEPTION 'Public access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='app_notifications_birthday_greeting_year_idx' AND i.indisunique AND i.indisvalid) THEN RAISE EXCEPTION 'Missing annual deduplication'; END IF;
  SELECT id INTO uid FROM auth.users ORDER BY id LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'No test account'; END IF;
  BEGIN
    INSERT INTO public.birthday_reminder_preferences(user_id,birth_month,birth_day) VALUES(uid,2,29)
    ON CONFLICT(user_id) DO UPDATE SET birth_month=2,birth_day=29;
    SELECT count(*) INTO n FROM adpel_private.plan_birthday_greetings('2040-02-29 10:00:00-03') WHERE recipient_id=uid;
    IF n<>1 THEN RAISE EXCEPTION 'Leap birthday missing'; END IF;
    SELECT count(*) INTO n FROM adpel_private.plan_birthday_greetings('2041-02-28 10:00:00-03') WHERE recipient_id=uid;
    IF n<>1 THEN RAISE EXCEPTION 'Non-leap birthday missing'; END IF;
    SELECT count(*) INTO n FROM adpel_private.plan_birthday_greetings('2040-02-28 10:00:00-03') WHERE recipient_id=uid;
    IF n<>0 THEN RAISE EXCEPTION 'Early greeting'; END IF;
    SELECT count(*) INTO n FROM adpel_private.plan_birthday_greetings('2040-02-29 08:00:00-03') WHERE recipient_id=uid;
    IF n<>0 THEN RAISE EXCEPTION 'Quiet hours'; END IF;
    BEGIN
      UPDATE public.birthday_reminder_preferences SET birth_month=4,birth_day=31 WHERE user_id=uid;
      RAISE EXCEPTION 'Invalid day accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.birthday_reminder_preferences;
    IF n<>0 THEN RAISE EXCEPTION 'Other user can view preference'; END IF;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub',uid::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.birthday_reminder_preferences WHERE birth_month=2 AND birth_day=29;
    IF n<>1 THEN RAISE EXCEPTION 'Owner cannot view'; END IF;
    DELETE FROM public.birthday_reminder_preferences WHERE user_id=uid;
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO n FROM adpel_private.plan_birthday_greetings('2040-02-29 10:00:00-03') WHERE recipient_id=uid;
    IF n<>0 THEN RAISE EXCEPTION 'Opt-out ignored'; END IF;
    RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback fixture';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END $test$;
SELECT 'birthday planner: PASS; no dispatch' AS result;
