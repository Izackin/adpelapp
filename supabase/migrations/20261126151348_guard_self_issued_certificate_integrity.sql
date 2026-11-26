BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION adpel_private.guard_self_issued_certificate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $guard$
DECLARE uid uuid:=auth.uid(); c public.courses%ROWTYPE; n integer; recipient text; stamp timestamptz:=now();
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') OR public.is_admin_master() IS TRUE THEN RETURN NEW; END IF;
 IF uid IS NULL OR NEW.user_id IS DISTINCT FROM uid OR NEW.course_id IS NULL THEN
  RAISE EXCEPTION 'Emissão automática permitida somente para seu próprio curso.' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':'||NEW.course_id::text, 451));
 IF EXISTS(SELECT 1 FROM public.certificates WHERE user_id=uid AND course_id=NEW.course_id) THEN
  RAISE EXCEPTION 'Certificado já emitido para este curso.' USING ERRCODE='23505';
 END IF;
 SELECT * INTO c FROM public.courses WHERE id=NEW.course_id AND is_published IS TRUE;
 IF NOT FOUND OR (c.is_paid AND NOT EXISTS(SELECT 1 FROM public.course_access WHERE user_id=uid AND course_id=c.id AND status='active')) THEN
  RAISE EXCEPTION 'Curso indisponível ou sem acesso autorizado.' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_array_length(lessons) INTO n FROM public.course_content WHERE course_id=c.id;
 IF n IS NULL OR n<1 OR n IS DISTINCT FROM c.lesson_count OR EXISTS(
  SELECT 1 FROM generate_series(0,n-1) AS required(idx)
  WHERE NOT EXISTS(SELECT 1 FROM public.user_lesson_progress p WHERE p.user_id=uid AND p.course_id=c.id AND p.lesson_index=required.idx AND p.completed IS TRUE)
 ) THEN RAISE EXCEPTION 'Conclua todas as aulas válidas para emitir o certificado.' USING ERRCODE='42501'; END IF;
 SELECT nullif(btrim(full_name),'') INTO recipient FROM public.profiles WHERE id=uid;
 IF recipient IS NULL THEN RAISE EXCEPTION 'Preencha seu nome no perfil antes de emitir.' USING ERRCODE='42501'; END IF;
 NEW.id:=gen_random_uuid(); NEW.user_id:=uid; NEW.course_id:=c.id;
 NEW.title:=coalesce(nullif(btrim(c.certificate_title),''),c.title);
 NEW.description:=coalesce(nullif(btrim(c.certificate_description),''),'Concluiu o curso "'||c.title||'" com êxito.');
 NEW.certificate_type:='curso'; NEW.member_id:=NULL; NEW.issued_by:=NULL; NEW.template_url:=NULL;
 NEW.completed_at:=stamp; NEW.issued_at:=stamp; NEW.created_at:=stamp; NEW.updated_at:=stamp; NEW.is_active:=true;
 NEW.certificate_data:=jsonb_build_object('user_name',recipient,'course_title',c.title,'course_duration',c.duration,'description',NEW.description,'completed_at',stamp);
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION adpel_private.guard_self_issued_certificate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER adpel_guard_self_issued_certificate BEFORE INSERT ON public.certificates FOR EACH ROW EXECUTE FUNCTION adpel_private.guard_self_issued_certificate();
COMMIT;

