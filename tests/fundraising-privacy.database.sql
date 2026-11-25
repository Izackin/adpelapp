-- Read-only financial authorization regression. No payments or rows are created.
DO $test$
DECLARE
  test_uid uuid := gen_random_uuid();
  has_rows boolean;
BEGIN
  IF has_table_privilege('anon','public.user_offering_summary','SELECT')
    OR has_table_privilege('anon','public.fundraising_stats_view_backup','SELECT')
    OR has_table_privilege('authenticated','public.fundraising_stats_view_backup','SELECT') THEN
    RAISE EXCEPTION 'Private financial view is exposed';
  END IF;
  IF NOT has_table_privilege('authenticated','public.user_offering_summary','SELECT')
    OR NOT has_table_privilege('anon','public.fundraising_stats','SELECT') THEN
    RAISE EXCEPTION 'Expected read grants missing';
  END IF;
  IF has_function_privilege('anon','public.recalcular_fundraising_stats(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.recalcular_fundraising_stats(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.trigger_recalcular_fundraising_stats()','EXECUTE')
    OR has_function_privilege('authenticated','public.trigger_recalcular_fundraising_stats()','EXECUTE') THEN
    RAISE EXCEPTION 'Privileged RPC is exposed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_uid)
    OR EXISTS (SELECT 1 FROM public.fundraising_contributions WHERE user_id = test_uid) THEN
    RAISE EXCEPTION 'Test identity collision';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT EXISTS(SELECT 1 FROM public.fundraising_contributions) INTO has_rows;
  IF has_rows OR public.is_admin_master() THEN
    RAISE EXCEPTION 'Anonymous financial access is not isolated';
  END IF;
  PERFORM 1 FROM public.fundraising_goals LIMIT 1;
  PERFORM 1 FROM public.fundraising_stats LIMIT 1;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',test_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',test_uid,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT EXISTS(SELECT 1 FROM public.fundraising_contributions) INTO has_rows;
  IF has_rows THEN RAISE EXCEPTION 'Non-owner can read contributions'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_offering_summary) INTO has_rows;
  IF has_rows OR public.is_admin_master() THEN
    RAISE EXCEPTION 'Non-owner has privileged financial access';
  END IF;
  EXECUTE 'RESET ROLE';
END
$test$;
SELECT 'financial authorization regression: PASS' AS result;
