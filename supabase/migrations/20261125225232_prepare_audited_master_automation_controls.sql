BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

CREATE TABLE adpel_private.automation_release_controls (
  automation_key text PRIMARY KEY CHECK (automation_key IN ('events','birthdays')),
  approved boolean NOT NULL DEFAULT false
);
ALTER TABLE adpel_private.automation_release_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adpel_private.automation_release_controls FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO adpel_private.automation_release_controls(automation_key) VALUES ('events'),('birthdays');

CREATE TABLE adpel_private.automation_control_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  automation_key text NOT NULL CHECK (automation_key IN ('events','birthdays')),
  changed_by uuid NOT NULL,
  previous_active boolean NOT NULL,
  new_active boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE adpel_private.automation_control_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adpel_private.automation_control_audit FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION adpel_private.get_automation_control_status()
RETURNS TABLE(automation_key text,scheduler_exists boolean,active boolean,opted_in bigint,
  eligible_now bigint,generated_total bigint,last_run_at timestamptz,last_run_status text,
  release_approved boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_master() THEN
    RAISE EXCEPTION 'Acesso restrito ao master' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.*,coalesce(c.approved,false)
    FROM adpel_private.get_automation_status() s
    LEFT JOIN adpel_private.automation_release_controls c USING(automation_key);
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.get_automation_control_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION adpel_private.get_automation_control_status() TO authenticated;

CREATE FUNCTION public.get_admin_automation_control_status()
RETURNS TABLE(automation_key text,scheduler_exists boolean,active boolean,opted_in bigint,
  eligible_now bigint,generated_total bigint,last_run_at timestamptz,last_run_status text,
  release_approved boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT * FROM adpel_private.get_automation_control_status(); $$;
REVOKE ALL ON FUNCTION public.get_admin_automation_control_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_automation_control_status() TO authenticated;

CREATE FUNCTION adpel_private.set_automation_active(p_key text,p_active boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job_name text; target_id bigint; was_active boolean; approved boolean; lock_key integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_master() THEN
    RAISE EXCEPTION 'Acesso restrito ao master' USING ERRCODE='42501';
  END IF;
  IF p_active IS NULL OR p_key IS NULL OR p_key NOT IN ('events','birthdays') THEN
    RAISE EXCEPTION 'Automação inválida' USING ERRCODE='22023';
  END IF;
  job_name := CASE p_key WHEN 'events' THEN 'adpel-event-reminders-v1' ELSE 'adpel-birthday-greetings-v1' END;
  lock_key := CASE p_key WHEN 'events' THEN 1 ELSE 2 END;
  PERFORM pg_advisory_xact_lock(661825,lock_key);
  SELECT c.approved INTO approved FROM adpel_private.automation_release_controls c WHERE c.automation_key=p_key FOR UPDATE;
  IF p_active AND NOT coalesce(approved,false) THEN
    RAISE EXCEPTION 'Ativação bloqueada até homologação' USING ERRCODE='42501';
  END IF;
  SELECT j.jobid,j.active INTO target_id,was_active FROM cron.job j WHERE j.jobname=job_name FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION 'Agendador indisponível'; END IF;
  IF was_active IS DISTINCT FROM p_active THEN
    PERFORM cron.alter_job(job_id:=target_id,active:=p_active);
    INSERT INTO adpel_private.automation_control_audit(automation_key,changed_by,previous_active,new_active)
      VALUES(p_key,auth.uid(),was_active,p_active);
  END IF;
  RETURN p_active;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.set_automation_active(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION adpel_private.set_automation_active(text,boolean) TO authenticated;

CREATE FUNCTION public.set_admin_automation_active(p_key text,p_active boolean)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT adpel_private.set_automation_active(p_key,p_active); $$;
REVOKE ALL ON FUNCTION public.set_admin_automation_active(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_admin_automation_active(text,boolean) TO authenticated;

COMMIT;
