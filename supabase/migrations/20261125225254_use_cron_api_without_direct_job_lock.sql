BEGIN;
SET LOCAL lock_timeout='3s';
CREATE OR REPLACE FUNCTION adpel_private.set_automation_active(p_key text, p_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  SELECT j.jobid,j.active INTO target_id,was_active FROM cron.job j WHERE j.jobname=job_name;
  IF target_id IS NULL THEN RAISE EXCEPTION 'Agendador indisponível'; END IF;
  IF was_active IS DISTINCT FROM p_active THEN
    PERFORM cron.alter_job(job_id:=target_id,active:=p_active);
    INSERT INTO adpel_private.automation_control_audit(automation_key,changed_by,previous_active,new_active)
      VALUES(p_key,auth.uid(),was_active,p_active);
  END IF;
  RETURN p_active;
END;
$function$;
COMMIT;
