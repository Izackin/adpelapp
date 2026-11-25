BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

CREATE FUNCTION adpel_private.get_automation_status()
RETURNS TABLE(automation_key text, scheduler_exists boolean, active boolean,
  opted_in bigint, eligible_now bigint, generated_total bigint,
  last_run_at timestamptz, last_run_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_master() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador master' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH metrics AS (
    SELECT 'events'::text AS key,'adpel-event-reminders-v1'::text AS job_name,
      (SELECT count(*) FROM public.event_reminder_preferences p WHERE p.enabled) AS opted,
      (SELECT count(*) FROM adpel_private.plan_event_reminders(now())) AS eligible,
      (SELECT count(*) FROM public.app_notifications n WHERE n.type='event_reminder') AS generated
    UNION ALL
    SELECT 'birthdays','adpel-birthday-greetings-v1',
      (SELECT count(*) FROM public.birthday_reminder_preferences),
      (SELECT count(*) FROM adpel_private.plan_birthday_greetings(now())),
      (SELECT count(*) FROM public.app_notifications n WHERE n.type='birthday_greeting')
  )
  SELECT m.key,j.jobid IS NOT NULL,coalesce(j.active,false),m.opted,m.eligible,m.generated,r.start_time,r.status
  FROM metrics m
  LEFT JOIN cron.job j ON j.jobname=m.job_name
  LEFT JOIN LATERAL (
    SELECT d.start_time,d.status FROM cron.job_run_details d
    WHERE d.jobid=j.jobid ORDER BY d.runid DESC LIMIT 1
  ) r ON true
  ORDER BY m.key;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.get_automation_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION adpel_private.get_automation_status() TO authenticated;

CREATE FUNCTION public.get_admin_automation_status()
RETURNS TABLE(automation_key text, scheduler_exists boolean, active boolean,
  opted_in bigint, eligible_now bigint, generated_total bigint,
  last_run_at timestamptz, last_run_status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT * FROM adpel_private.get_automation_status(); $$;
REVOKE ALL ON FUNCTION public.get_admin_automation_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_automation_status() TO authenticated;

COMMIT;
