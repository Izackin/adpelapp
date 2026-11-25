BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Public clients now use public_event_attendance_summary and public_spiritual_ranking.
-- Preserve the original insert/delete ownership policies for attendance.
ALTER POLICY "Presenças - leitura pública" ON public.event_attendances
  TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_master()));
ALTER POLICY "Ranking Public" ON public.spiritual_progress
  TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_master()));

-- Keep authenticated access subject to RLS; prevent direct anonymous reads.
REVOKE SELECT ON public.event_attendances, public.spiritual_progress FROM PUBLIC, anon;

COMMIT;
