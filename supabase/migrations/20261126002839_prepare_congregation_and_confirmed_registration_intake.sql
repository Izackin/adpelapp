BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.congregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{1,80}$'),
  name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.congregations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.congregations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.congregations TO anon,authenticated;
CREATE POLICY congregations_active_read ON public.congregations FOR SELECT TO anon,authenticated USING(active IS TRUE);
INSERT INTO public.congregations(slug,name) VALUES('adpel-santo-andre','ADPEL SANTO ANDRÉ');

ALTER TABLE public.members ADD COLUMN congregation_id uuid REFERENCES public.congregations(id) ON DELETE RESTRICT;
CREATE INDEX members_congregation_idx ON public.members(congregation_id);
ALTER TABLE public.members DROP CONSTRAINT members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK(status IN ('ativo','afastado','transferido','falecido','removido','pendente'));

CREATE TABLE public.member_registration_intakes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE RESTRICT,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  declared_type text NOT NULL CHECK(declared_type IN ('membro','visitante')),
  full_name text NOT NULL CHECK(char_length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK(char_length(email) BETWEEN 3 AND 254),
  whatsapp text NOT NULL CHECK(whatsapp ~ '^[0-9]{10,11}$'),
  birth_date date,
  contact_allowed boolean NOT NULL DEFAULT false,
  review_required boolean NOT NULL DEFAULT false,
  followup_status text NOT NULL DEFAULT 'novo' CHECK(followup_status IN ('novo','em_acompanhamento','concluido')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_registration_intakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_registration_intakes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.member_registration_intakes TO authenticated;
GRANT UPDATE(followup_status) ON public.member_registration_intakes TO authenticated;
CREATE POLICY member_intake_master_read ON public.member_registration_intakes FOR SELECT TO authenticated USING((SELECT public.is_admin_master()) IS TRUE);
CREATE POLICY member_intake_master_update ON public.member_registration_intakes FOR UPDATE TO authenticated USING((SELECT public.is_admin_master()) IS TRUE) WITH CHECK((SELECT public.is_admin_master()) IS TRUE);
CREATE INDEX member_intakes_congregation_idx ON public.member_registration_intakes(congregation_id);
CREATE INDEX member_intakes_member_idx ON public.member_registration_intakes(member_id);

CREATE FUNCTION adpel_private.process_confirmed_member_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  m jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb);
  v_name text; v_email text; v_phone text; v_birth date; v_kind text;
  v_congregation uuid; v_member uuid; v_duplicate boolean; v_contact boolean;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR m->>'registration_version' IS DISTINCT FROM '1' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  v_name := btrim(coalesce(m->>'full_name',''));
  v_email := lower(btrim(coalesce(NEW.email,'')));
  v_kind := m->>'declared_type';
  v_phone := regexp_replace(coalesce(m->>'registration_whatsapp',''),'[^0-9]','','g');
  IF length(v_phone) IN (12,13) AND left(v_phone,2)='55' THEN v_phone:=substr(v_phone,3); END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 OR char_length(v_email) NOT BETWEEN 3 AND 254
    OR v_kind IS NULL OR v_kind NOT IN ('membro','visitante') OR v_phone !~ '^[1-9][0-9]{9,10}$'
    OR m->>'registration_privacy_ack' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
  SELECT id INTO v_congregation FROM public.congregations WHERE slug=m->>'congregation_slug' AND active IS TRUE;
  IF v_congregation IS NULL THEN RETURN NEW; END IF;
  IF nullif(m->>'registration_birth_date','') IS NOT NULL THEN
    IF m->>'registration_birth_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NEW; END IF;
    BEGIN v_birth := (m->>'registration_birth_date')::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NEW; END;
    IF v_birth > current_date OR v_birth < current_date - interval '120 years' THEN RETURN NEW; END IF;
  END IF;
  -- Contact is optional; no direct follow-up to declared minors or unknown ages.
  v_contact := coalesce(m->>'registration_contact_allowed'='true',false)
    AND v_birth IS NOT NULL AND v_birth <= (current_date-interval '18 years')::date;
  PERFORM pg_advisory_xact_lock(661825,40);
  IF EXISTS(SELECT 1 FROM public.member_registration_intakes WHERE user_id=NEW.id) THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.members x WHERE lower(btrim(x.email))=v_email OR
      CASE WHEN length(regexp_replace(coalesce(x.phone,''),'[^0-9]','','g')) IN (12,13)
        AND left(regexp_replace(coalesce(x.phone,''),'[^0-9]','','g'),2)='55'
      THEN substr(regexp_replace(coalesce(x.phone,''),'[^0-9]','','g'),3)
      ELSE regexp_replace(coalesce(x.phone,''),'[^0-9]','','g') END=v_phone
    UNION ALL SELECT 1 FROM public.member_registration_intakes i WHERE i.email=v_email OR i.whatsapp=v_phone
    UNION ALL SELECT 1 FROM public.member_account_links l WHERE l.user_id=NEW.id
  ) INTO v_duplicate;
  IF NOT v_duplicate THEN
    INSERT INTO public.members(full_name,email,phone,birth_date,role,status,congregation_id)
      VALUES(v_name,v_email,CASE WHEN v_contact THEN v_phone ELSE NULL END,v_birth,v_kind,'pendente',v_congregation)
      RETURNING id INTO v_member;
    INSERT INTO public.member_account_links(member_id,user_id,linked_by) VALUES(v_member,NEW.id,NULL);
  END IF;
  INSERT INTO public.member_registration_intakes(user_id,congregation_id,member_id,declared_type,full_name,email,whatsapp,birth_date,contact_allowed,review_required)
    VALUES(NEW.id,v_congregation,v_member,v_kind,v_name,v_email,v_phone,v_birth,v_contact,v_duplicate);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.process_confirmed_member_registration() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_adpel_member_registration_insert AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION adpel_private.process_confirmed_member_registration();
CREATE TRIGGER zz_adpel_member_registration_confirm AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION adpel_private.process_confirmed_member_registration();
COMMIT;
