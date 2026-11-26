DO $test$
DECLARE mid uuid; uid uuid; master_id uuid; n bigint; prev_count bigint;
BEGIN
 SELECT id INTO master_id FROM public.profiles WHERE role='master' LIMIT 1;
 SELECT id INTO uid FROM public.profiles WHERE role='user' AND id NOT IN(SELECT user_id FROM public.member_registration_intakes) LIMIT 1;
 SELECT count(*) INTO prev_count FROM public.member_movements;
 BEGIN
  INSERT INTO public.members(full_name,status) VALUES('Teste temporário','pendente') RETURNING id INTO mid;
  INSERT INTO public.member_registration_intakes(user_id,congregation_id,declared_type,full_name,email,whatsapp,review_required)
  SELECT uid,id,'membro','Teste temporário','test@example.invalid','11900000000',true FROM public.congregations LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',master_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.member_account_links(member_id,user_id) VALUES(mid,uid);
  IF NOT EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=uid AND member_id=mid AND NOT review_required) THEN RAISE EXCEPTION 'sync failed'; END IF;
  INSERT INTO public.member_movements(member_id,movement_type) VALUES(mid,'saida');
  IF NOT EXISTS(SELECT 1 FROM public.members WHERE id=mid AND status='removido') OR NOT EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=uid AND followup_status='concluido') THEN RAISE EXCEPTION 'archive failed'; END IF;
  BEGIN
    INSERT INTO public.member_movements(member_id,movement_type) VALUES(mid,'saida');
    RAISE EXCEPTION 'duplicate was allowed' USING ERRCODE='ZX002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%já está arquivado%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO n FROM public.member_movements WHERE member_id=mid AND movement_type='saida';
  IF n<>1 THEN RAISE EXCEPTION 'wrong exit count'; END IF;
  INSERT INTO public.member_movements(member_id,movement_type) VALUES(mid,'retorno');
  INSERT INTO public.member_movements(member_id,movement_type) VALUES(mid,'saida');
  IF (SELECT count(*) FROM public.member_movements WHERE member_id=mid AND movement_type='saida')<>2 THEN RAISE EXCEPTION 'legitimate second exit failed'; END IF;
  DELETE FROM public.member_account_links WHERE member_id=mid;
  IF NOT EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=uid AND member_id IS NULL AND review_required) THEN RAISE EXCEPTION 'unlink sync failed'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF (SELECT count(*) FROM public.member_movements)<>prev_count OR EXISTS(SELECT 1 FROM public.members WHERE id=mid) OR EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=uid) THEN RAISE EXCEPTION 'rollback failed'; END IF;
END $test$;
SELECT 'member exit and intake sync: PASS' AS result;
