DO $test$
DECLARE u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); u4 uuid:=gen_random_uuid(); u5 uuid:=gen_random_uuid(); m1 uuid; m2 uuid; meta jsonb; n bigint;
BEGIN
  IF has_table_privilege('anon','public.member_registration_intakes','SELECT') OR has_table_privilege('authenticated','public.member_registration_intakes','INSERT') OR has_column_privilege('authenticated','public.member_registration_intakes','contact_allowed','UPDATE') THEN RAISE EXCEPTION 'unsafe privileges'; END IF;
  meta:=jsonb_build_object('registration_version','1','full_name','Teste Cadastro','declared_type','membro','registration_whatsapp','11981234567','registration_privacy_ack',true,'registration_contact_allowed',true,'registration_birth_date','1990-01-01','congregation_slug','adpel-santo-andre');
  BEGIN
    -- Simulates the database state of an automatic confirmation without sending email.
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(u1,u1::text||'@example.invalid',now(),meta);
    SELECT member_id INTO m1 FROM public.member_registration_intakes WHERE user_id=u1 AND declared_type='membro' AND contact_allowed AND NOT review_required;
    IF m1 IS NULL OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=m1 AND role='membro' AND status='pendente' AND phone='11981234567') OR NOT EXISTS(SELECT 1 FROM public.member_account_links WHERE member_id=m1 AND user_id=u1 AND linked_by IS NULL) THEN RAISE EXCEPTION 'member registration failed'; END IF;
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(u2,u2::text||'@example.invalid',now(),meta||'{"declared_type":"visitante","registration_whatsapp":"11981234568","registration_contact_allowed":false,"registration_birth_date":""}'::jsonb);
    SELECT member_id INTO m2 FROM public.member_registration_intakes WHERE user_id=u2 AND declared_type='visitante' AND NOT contact_allowed;
    IF m2 IS NULL OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=m2 AND role='visitante' AND status='pendente' AND phone IS NULL) THEN RAISE EXCEPTION 'visitor registration failed'; END IF;
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(u3,u3::text||'@example.invalid',now(),meta);
    IF NOT EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=u3 AND review_required AND member_id IS NULL) THEN RAISE EXCEPTION 'duplicate allowed'; END IF;
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(u4,u4::text||'@example.invalid',now(),'{"full_name":"Legacy"}'::jsonb),(u5,u5::text||'@example.invalid',now(),meta||'{"registration_birth_date":"2099-01-01","role":"master"}'::jsonb);
    IF EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id IN(u4,u5)) OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN(u1,u2,u3,u4,u5) AND role<>'user') THEN RAISE EXCEPTION 'invalid or legacy registration handling'; END IF;
    UPDATE auth.users SET email_confirmed_at=now()+interval '1 second' WHERE id=u1;
    IF (SELECT count(*) FROM public.member_registration_intakes WHERE user_id IN(u1,u2,u3))<>3 THEN RAISE EXCEPTION 'repeated confirmation'; END IF;
    PERFORM set_config('request.jwt.claim.sub',u1::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u1,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.member_registration_intakes;
    IF n<>0 THEN RAISE EXCEPTION 'member can read intake'; END IF;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id IN(u1,u2,u3,u4,u5)) OR EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id IN(u1,u2,u3,u4,u5)) THEN RAISE EXCEPTION 'rollback failed'; END IF;
END $test$;
SELECT 'auto-confirmed registration intake: PASS; no committed test data' AS result;
