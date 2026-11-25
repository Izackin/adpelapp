BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.event_reminder_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE public.event_reminder_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_reminder_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.event_reminder_preferences TO authenticated;
CREATE POLICY event_reminder_preferences_own_read ON public.event_reminder_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY event_reminder_preferences_own_insert ON public.event_reminder_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY event_reminder_preferences_own_update ON public.event_reminder_preferences
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE UNIQUE INDEX app_notifications_event_reminder_once_idx
ON public.app_notifications (recipient_id, entity_id)
WHERE type = 'event_reminder' AND entity_type = 'event';

-- Private, invoker-only planner. Time input makes simulations possible without sending.
CREATE FUNCTION adpel_private.plan_event_reminders(p_now timestamptz)
RETURNS TABLE(recipient_id uuid, event_id uuid, event_title text, event_day date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$
  WITH local_clock AS (
    SELECT p_now AT TIME ZONE 'America/Sao_Paulo' AS ts
  ), eligible AS (
    SELECT a.user_id, e.id, e.title, e.event_date,
      row_number() OVER (PARTITION BY a.user_id ORDER BY e.event_date, e.id) AS position,
      (SELECT count(*) FROM public.app_notifications n
       WHERE n.recipient_id=a.user_id AND n.type='event_reminder'
         AND n.created_at >= (c.ts::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AND n.created_at < ((c.ts::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')) AS already_today
    FROM public.events e
    JOIN public.event_attendances a ON a.event_id=e.id
    JOIN public.event_reminder_preferences p ON p.user_id=a.user_id AND p.enabled IS TRUE
    CROSS JOIN local_clock c
    WHERE e.is_active IS TRUE AND e.is_published IS TRUE
      AND e.event_date=c.ts::date+1
      AND c.ts::time >= time '09:00' AND c.ts::time < time '20:00'
      AND NOT EXISTS (SELECT 1 FROM public.app_notifications n
        WHERE n.recipient_id=a.user_id AND n.entity_id=e.id
          AND n.type='event_reminder' AND n.entity_type='event')
  )
  SELECT user_id,id,title,event_date FROM eligible
  WHERE position + already_today <= 2
  ORDER BY event_date,id,user_id LIMIT 30;
$$;
REVOKE ALL ON FUNCTION adpel_private.plan_event_reminders(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION adpel_private.dispatch_event_reminders()
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog
AS $$
DECLARE inserted_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(661825, 1) THEN RETURN 0; END IF;
  INSERT INTO public.app_notifications (recipient_id,type,title,body,entity_type,entity_id,url)
  SELECT p.recipient_id,'event_reminder','Lembrete de evento',
    left('Amanhã: ' || p.event_title || ' (' || to_char(p.event_day,'DD/MM') || '). Confira os detalhes na agenda.',1000),
    'event',p.event_id,'#community-hub'
  FROM adpel_private.plan_event_reminders(now()) p
  ON CONFLICT (recipient_id, entity_id) WHERE type='event_reminder' AND entity_type='event' DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.dispatch_event_reminders() FROM PUBLIC, anon, authenticated, service_role;

-- Provision the scheduled job disabled, in the same transaction.
DO $$
DECLARE job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='adpel-event-reminders-v1') THEN
    RAISE EXCEPTION 'Event reminder job already exists';
  END IF;
  job := cron.schedule('adpel-event-reminders-v1','*/30 * * * *','SELECT adpel_private.dispatch_event_reminders();');
  PERFORM cron.alter_job(job_id := job, active := false);
END;
$$;
COMMIT;
