BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Store only day/month supplied voluntarily by the account owner.
CREATE TABLE public.birthday_reminder_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_month smallint NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day smallint NOT NULL CHECK (birth_day BETWEEN 1 AND
    CASE birth_month WHEN 2 THEN 29 WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END)
);
ALTER TABLE public.birthday_reminder_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.birthday_reminder_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_reminder_preferences TO authenticated;
CREATE POLICY birthday_reminder_own_read ON public.birthday_reminder_preferences FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY birthday_reminder_own_insert ON public.birthday_reminder_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY birthday_reminder_own_update ON public.birthday_reminder_preferences FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY birthday_reminder_own_delete ON public.birthday_reminder_preferences FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));

CREATE UNIQUE INDEX app_notifications_birthday_greeting_year_idx
ON public.app_notifications (recipient_id, (EXTRACT(YEAR FROM created_at AT TIME ZONE 'America/Sao_Paulo')))
WHERE type='birthday_greeting';

CREATE FUNCTION adpel_private.plan_birthday_greetings(p_now timestamptz)
RETURNS TABLE(recipient_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$
  WITH local_clock AS (
    SELECT p_now AT TIME ZONE 'America/Sao_Paulo' AS ts
  )
  SELECT p.user_id FROM public.birthday_reminder_preferences p CROSS JOIN local_clock c
  WHERE c.ts::time >= time '09:00' AND c.ts::time < time '20:00'
    AND p.birth_month=EXTRACT(MONTH FROM c.ts)
    AND (
      p.birth_day=EXTRACT(DAY FROM c.ts)
      OR (p.birth_month=2 AND p.birth_day=29 AND EXTRACT(DAY FROM c.ts)=28
        AND EXTRACT(DAY FROM (make_date(EXTRACT(YEAR FROM c.ts)::integer,3,1)-1))=28)
    )
    AND NOT EXISTS (SELECT 1 FROM public.app_notifications n
      WHERE n.recipient_id=p.user_id AND n.type='birthday_greeting'
        AND EXTRACT(YEAR FROM n.created_at AT TIME ZONE 'America/Sao_Paulo')=EXTRACT(YEAR FROM c.ts))
  ORDER BY p.user_id LIMIT 30;
$$;
REVOKE ALL ON FUNCTION adpel_private.plan_birthday_greetings(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION adpel_private.dispatch_birthday_greetings()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE inserted_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(661825,2) THEN RETURN 0; END IF;
  INSERT INTO public.app_notifications(recipient_id,type,title,body,entity_type,url)
  SELECT p.recipient_id,'birthday_greeting','Feliz aniversário!',
    'Que Deus abençoe seu novo ciclo com paz, alegria e esperança. A família ADPEL deseja um dia especial para você.',
    'birthday','#home'
  FROM adpel_private.plan_birthday_greetings(now()) p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.dispatch_birthday_greetings() FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='adpel-birthday-greetings-v1') THEN
    RAISE EXCEPTION 'Birthday job already exists';
  END IF;
  job := cron.schedule('adpel-birthday-greetings-v1','*/30 * * * *','SELECT adpel_private.dispatch_birthday_greetings();');
  PERFORM cron.alter_job(job_id:=job,active:=false);
END;
$$;
COMMIT;
