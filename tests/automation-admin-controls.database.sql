DO $test$
DECLARE master_id uuid; stranger uuid:=gen_random_uuid(); n bigint; actual boolean;
BEGIN
 IF has_function_privilege('anon','public.set_admin_automation_active(text,boolean)','EXECUTE')
 OR has_table_privilege('authenticated','adpel_private.automation_release_controls','UPDATE')
 OR has_table_privilege('authenticated','adpel_private.automation_control_audit','SELECT') THEN RAISE EXCEPTION 'Unsafe privileges'; END IF;
 SELECT id INTO master_id FROM public.profiles WHERE role='master' ORDER BY id LIMIT 1;
 IF master_id IS NULL THEN RAISE EXCEPTION 'No master profile'; END IF;
 PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN PERFORM public.set_admin_automation_active('events',false); RAISE EXCEPTION 'Unauthorized control'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_admin_automation_control_status(); RAISE EXCEPTION 'Unauthorized status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub',master_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.get_admin_automation_control_status() WHERE scheduler_exists AND NOT active AND NOT release_approved;
 IF n<>2 THEN RAISE EXCEPTION 'Unexpected initial state'; END IF;
 BEGIN PERFORM public.set_admin_automation_active('events',true); RAISE EXCEPTION 'Release gate bypassed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.set_admin_automation_active('unknown',false); RAISE EXCEPTION 'Unknown automation accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 EXECUTE 'RESET ROLE';
 BEGIN
  UPDATE adpel_private.automation_release_controls SET approved=true WHERE automation_key='events';
  EXECUTE 'SET LOCAL ROLE authenticated';
  actual:=public.set_admin_automation_active('events',true);
  IF actual IS DISTINCT FROM true THEN RAISE EXCEPTION 'Activation failed'; END IF;
  PERFORM public.set_admin_automation_active('events',true);
  actual:=public.set_admin_automation_active('events',false);
  IF actual IS DISTINCT FROM false THEN RAISE EXCEPTION 'Pause failed'; END IF;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM adpel_private.automation_control_audit WHERE automation_key='events';
  IF n<>2 THEN RAISE EXCEPTION 'Expected exactly two audit records'; END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='adpel-event-reminders-v1' AND active) THEN RAISE EXCEPTION 'Pause not persisted'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback test changes';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF EXISTS (SELECT 1 FROM adpel_private.automation_release_controls WHERE approved)
 OR EXISTS (SELECT 1 FROM cron.job WHERE jobname IN ('adpel-event-reminders-v1','adpel-birthday-greetings-v1') AND active)
 OR EXISTS (SELECT 1 FROM adpel_private.automation_control_audit) THEN RAISE EXCEPTION 'Rollback failed'; END IF;
END $test$;
SELECT 'automation controls: PASS; no committed activation' AS result;
