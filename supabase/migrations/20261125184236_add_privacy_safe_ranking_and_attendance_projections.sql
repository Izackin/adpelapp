BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Public ranking contains only the fields displayed in the app.
-- The private helper has an intentionally narrow output and cannot modify data.
CREATE FUNCTION adpel_private.get_public_spiritual_ranking()
RETURNS TABLE(user_id uuid, user_name text, avatar_url text, xp integer, total_points integer, streak_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT s.user_id,
    coalesce(nullif(btrim(p.public_name), ''), nullif(btrim(p.full_name), ''), 'Membro'),
    p.avatar_url, coalesce(s.xp,0), coalesce(s.total_points,0), coalesce(s.streak_days,0)
  FROM public.spiritual_progress s
  JOIN public.profiles p ON p.id=s.user_id
  WHERE p.show_public_profile IS NOT FALSE AND p.show_in_ranking IS NOT FALSE;
$$;
REVOKE ALL ON FUNCTION adpel_private.get_public_spiritual_ranking() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adpel_private.get_public_spiritual_ranking() TO anon, authenticated;
CREATE VIEW public.public_spiritual_ranking WITH (security_invoker=true, security_barrier=true) AS
  SELECT * FROM adpel_private.get_public_spiritual_ranking();
REVOKE ALL ON public.public_spiritual_ranking FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_spiritual_ranking TO anon, authenticated;

-- Only aggregate counts of published, active events and the caller's own status.
CREATE FUNCTION adpel_private.get_public_event_attendance_summary()
RETURNS TABLE(event_id uuid, confirmed_count bigint, has_confirmed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT e.id, count(a.id),
    coalesce(bool_or(a.user_id = (SELECT auth.uid())), false)
  FROM public.events e
  LEFT JOIN public.event_attendances a ON a.event_id=e.id
  WHERE e.is_published IS TRUE AND e.is_active IS TRUE
  GROUP BY e.id;
$$;
REVOKE ALL ON FUNCTION adpel_private.get_public_event_attendance_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adpel_private.get_public_event_attendance_summary() TO anon, authenticated;
CREATE VIEW public.public_event_attendance_summary WITH (security_invoker=true, security_barrier=true) AS
  SELECT * FROM adpel_private.get_public_event_attendance_summary();
REVOKE ALL ON public.public_event_attendance_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_event_attendance_summary TO anon, authenticated;

-- Transitional compatibility: respect profile/ranking visibility immediately.
-- After frontend rollout, replace this public predicate with owner/master only.
ALTER POLICY "Ranking Public" ON public.spiritual_progress TO anon, authenticated
USING (
  user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_master()) OR
  EXISTS (SELECT 1 FROM public.public_profiles p
    WHERE p.id=spiritual_progress.user_id AND p.show_public_profile IS TRUE AND p.show_in_ranking IS TRUE)
);
COMMIT;
