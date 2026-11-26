DO $test$
DECLARE u uuid; m uuid; c uuid:=gen_random_uuid(); paid uuid:=gen_random_uuid(); cert uuid; title_out text; data_out jsonb;
BEGIN
 SELECT id INTO u FROM public.profiles WHERE role='user' LIMIT 1;
 SELECT id INTO m FROM public.profiles WHERE role='master' LIMIT 1;
 IF u IS NULL OR m IS NULL THEN RAISE EXCEPTION 'Test requires existing ordinary and master profiles'; END IF;
 BEGIN
 INSERT INTO public.courses(id,title,is_published,lesson_count,is_paid,price_cents) VALUES(c,'Curso temporário auditoria',true,2,false,0),(paid,'Curso pago temporário auditoria',true,1,true,100);
 INSERT INTO public.course_content(course_id,lessons) VALUES(c,'[{"url":"https://example.invalid/1"},{"url":"https://example.invalid/2"}]'),(paid,'[{"url":"https://example.invalid/1"}]');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
 INSERT INTO public.certificates(user_id,title) VALUES(u,'Certificado indevido');
 RAISE EXCEPTION 'null course allowed' USING ERRCODE='ZX002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.certificates(user_id,course_id,title) VALUES(u,c,'Certificado indevido');
 RAISE EXCEPTION 'incomplete course allowed' USING ERRCODE='ZX002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.certificates(user_id,course_id,title) VALUES(u,paid,'Certificado indevido');
 RAISE EXCEPTION 'unpaid course allowed' USING ERRCODE='ZX002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.user_lesson_progress(user_id,course_id,lesson_index,completed) VALUES(u,c,0,true),(u,c,99,true);
 BEGIN
 INSERT INTO public.certificates(user_id,course_id,title) VALUES(u,c,'Certificado indevido');
 RAISE EXCEPTION 'invalid index counted' USING ERRCODE='ZX002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.user_lesson_progress(user_id,course_id,lesson_index,completed) VALUES(u,c,1,true);
 INSERT INTO public.certificates(user_id,course_id,title,certificate_data,certificate_type) VALUES(u,c,'Título falso','{"user_name":"Falso"}','batismo') RETURNING id,title,certificate_data INTO cert,title_out,data_out;
 IF title_out<>'Curso temporário auditoria' OR data_out->>'user_name'='Falso' OR NOT EXISTS(SELECT 1 FROM public.certificates WHERE id=cert AND certificate_type='curso' AND member_id IS NULL) THEN RAISE EXCEPTION 'canonical data failed'; END IF;
 BEGIN
 INSERT INTO public.certificates(user_id,course_id,title) VALUES(u,c,'Duplicado');
 RAISE EXCEPTION 'duplicate allowed' USING ERRCODE='ZX002';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub',m::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 INSERT INTO public.certificates(title,certificate_type) VALUES('Teste administrativo temporário','batismo');
 EXECUTE 'RESET ROLE';
 RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.courses WHERE id IN(c,paid)) OR EXISTS(SELECT 1 FROM public.certificates WHERE id=cert) THEN RAISE EXCEPTION 'rollback failed'; END IF;
END $test$;
SELECT 'certificate integrity: PASS' AS result;
