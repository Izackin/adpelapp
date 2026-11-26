DO $test$
DECLARE own_id uuid; owner_id uuid; other_id uuid; affected integer; original_count bigint;
BEGIN
 SELECT id,recipient_id INTO own_id,owner_id FROM public.app_notifications WHERE dismissed_at IS NULL ORDER BY created_at DESC LIMIT 1;
 SELECT id INTO other_id FROM public.app_notifications WHERE recipient_id<>owner_id LIMIT 1;
 IF own_id IS NULL OR other_id IS NULL THEN RAISE EXCEPTION 'Need distinct existing recipients'; END IF;
 SELECT count(*) INTO original_count FROM public.app_notifications;
 IF has_table_privilege('authenticated','public.app_notifications','DELETE') OR has_column_privilege('authenticated','public.app_notifications','title','UPDATE') OR has_column_privilege('anon','public.app_notifications','dismissed_at','UPDATE') THEN RAISE EXCEPTION 'Unsafe grants'; END IF;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.app_notifications SET dismissed_at=now() WHERE id=other_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Cross-account change allowed'; END IF;
  UPDATE public.app_notifications SET dismissed_at=now() WHERE id=own_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Own dismissal failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.app_notifications WHERE id=own_id AND dismissed_at IS NULL) THEN RAISE EXCEPTION 'Dismissed row still visible to inbox query'; END IF;
  EXECUTE 'RESET ROLE';
  IF (SELECT count(*) FROM public.app_notifications)<>original_count THEN RAISE EXCEPTION 'History deleted'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback test';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.app_notifications WHERE id=own_id AND dismissed_at IS NOT NULL) THEN RAISE EXCEPTION 'Rollback failed'; END IF;
END $test$;
SELECT 'inbox dismissal: PASS; no committed removals' AS result;
