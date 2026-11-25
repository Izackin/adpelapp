DO $test$
DECLARE master_id uuid; n bigint; stranger uuid:=gen_random_uuid();
BEGIN
  IF has_function_privilege('anon','public.get_admin_automation_status()','EXECUTE')
     OR has_function_privilege('anon','adpel_private.get_automation_status()','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous status access';
  END IF;
  SELECT id INTO master_id FROM public.profiles WHERE role='master' ORDER BY id LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'No master profile available'; END IF;
  PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.get_admin_automation_status();
    RAISE EXCEPTION 'Non-master status access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',master_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_admin_automation_status() WHERE automation_key IN ('events','birthdays') AND scheduler_exists AND NOT active AND opted_in>=0 AND eligible_now>=0 AND generated_total>=0;
  IF n<>2 THEN RAISE EXCEPTION 'Unexpected master status or scheduler state'; END IF;
  EXECUTE 'RESET ROLE';
END $test$;
SELECT 'automation status: PASS' AS result;
