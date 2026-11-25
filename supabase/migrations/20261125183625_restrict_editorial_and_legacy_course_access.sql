BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Preserve the published-content read path; writes are master-only.
ALTER POLICY "Versiculo do Dia - insercao autenticada" ON public.verse_of_day
  WITH CHECK ((SELECT public.is_admin_master()));
ALTER POLICY "Versiculo do Dia - atualizacao autenticada" ON public.verse_of_day
  USING ((SELECT public.is_admin_master()))
  WITH CHECK ((SELECT public.is_admin_master()));
ALTER POLICY "Versiculo do Dia - exclusao autenticada" ON public.verse_of_day
  USING ((SELECT public.is_admin_master()));

-- Legacy normalized course tables: never expose unpublished or paid lesson URLs.
DROP POLICY "Public full access course_modules" ON public.course_modules;
DROP POLICY "Public full access course_lessons" ON public.course_lessons;
DROP POLICY "Public can read modules of published courses" ON public.course_modules;
DROP POLICY "Public can read published lessons" ON public.course_lessons;

CREATE POLICY course_modules_master_all ON public.course_modules
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_master())) WITH CHECK ((SELECT public.is_admin_master()));
CREATE POLICY course_lessons_master_all ON public.course_lessons
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_master())) WITH CHECK ((SELECT public.is_admin_master()));

CREATE POLICY course_modules_free_read_anon ON public.course_modules
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_modules.course_id AND c.is_published IS TRUE AND c.is_paid IS FALSE
  ));
CREATE POLICY course_modules_entitled_read ON public.course_modules
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_modules.course_id AND c.is_published IS TRUE
      AND (c.is_paid IS FALSE OR EXISTS (
        SELECT 1 FROM public.course_access ca WHERE ca.course_id=c.id
          AND ca.user_id=(SELECT auth.uid()) AND ca.status='active'
      ))
  ));
-- Module RLS already enforces course publication and entitlement.
CREATE POLICY course_lessons_published_read ON public.course_lessons
  FOR SELECT TO anon, authenticated USING (
    is_published IS TRUE AND EXISTS (
      SELECT 1 FROM public.course_modules m WHERE m.id=course_lessons.module_id
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.course_modules, public.course_lessons, public.verse_of_day FROM PUBLIC, anon;
REVOKE TRUNCATE ON public.course_modules, public.course_lessons, public.verse_of_day FROM authenticated;
COMMIT;
