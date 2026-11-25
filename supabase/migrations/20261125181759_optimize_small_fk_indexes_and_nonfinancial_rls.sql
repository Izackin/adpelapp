BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
-- Preserve policy roles, commands, and access predicates. No payment changes.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM (VALUES
('app_update_reads', 'app_update_reads_insert_own', NULL, '(auth.uid() = user_id)', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('app_update_reads', 'app_update_reads_select_own', '(auth.uid() = user_id)', NULL, 'SELECT', '{authenticated}', 'PERMISSIVE'),
('community_comments', 'community_comments_delete_own_or_master', '((user_id = auth.uid()) OR is_admin_master())', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('community_comments', 'community_comments_insert_own', NULL, '((user_id = auth.uid()) AND (status = ''published''::text) AND (EXISTS ( SELECT 1
   FROM community_posts p
  WHERE ((p.id = community_comments.post_id) AND (p.status = ''published''::text)))))', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('community_comments', 'community_comments_select_published', '((status = ''published''::text) OR (user_id = auth.uid()) OR is_admin_master())', NULL, 'SELECT', '{authenticated}', 'PERMISSIVE'),
('community_comments', 'community_comments_update_own_or_admin', '((user_id = auth.uid()) OR is_admin_master())', '((user_id = auth.uid()) OR is_admin_master())', 'UPDATE', '{authenticated}', 'PERMISSIVE'),
('community_posts', 'community_posts_delete_own_or_master', '((user_id = auth.uid()) OR is_admin_master())', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('community_posts', 'community_posts_insert_own', NULL, '((user_id = auth.uid()) AND (status = ''published''::text))', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('community_posts', 'community_posts_select_published', '((status = ''published''::text) OR (user_id = auth.uid()) OR is_admin_master())', NULL, 'SELECT', '{authenticated}', 'PERMISSIVE'),
('community_posts', 'community_posts_update_own_or_admin', '((user_id = auth.uid()) OR is_admin_master())', '((user_id = auth.uid()) OR is_admin_master())', 'UPDATE', '{authenticated}', 'PERMISSIVE'),
('community_reactions', 'community_reactions_delete_own', '((user_id = auth.uid()) OR is_admin_master())', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('community_reactions', 'community_reactions_insert_own', NULL, '((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM community_posts p
  WHERE ((p.id = community_reactions.post_id) AND (p.status = ''published''::text)))))', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('event_attendances', 'Presenças - exclusão próprio usuário', '(auth.uid() = user_id)', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('event_attendances', 'Presenças - inserção próprio usuário', NULL, '(auth.uid() = user_id)', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('profiles', 'profiles_insert_self', NULL, '(id = auth.uid())', 'INSERT', '{public}', 'PERMISSIVE'),
('profiles', 'profiles_update_self_or_master', '((id = auth.uid()) OR is_admin_master())', '((id = auth.uid()) OR is_admin_master())', 'UPDATE', '{public}', 'PERMISSIVE'),
('user_lesson_progress', 'Progresso - exclusão própria', '(auth.uid() = user_id)', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Progresso - inserção própria', NULL, '(auth.uid() = user_id)', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Progresso - leitura própria', '(auth.uid() = user_id)', NULL, 'SELECT', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Usuários atualizam apenas seu próprio progresso', '(auth.uid() = user_id)', NULL, 'UPDATE', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Usuários deletam apenas seu próprio progresso', '(auth.uid() = user_id)', NULL, 'DELETE', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Usuários inserem apenas seu próprio progresso', NULL, '(auth.uid() = user_id)', 'INSERT', '{authenticated}', 'PERMISSIVE'),
('user_lesson_progress', 'Usuários veem apenas seu próprio progresso', '(auth.uid() = user_id)', NULL, 'SELECT', '{authenticated}', 'PERMISSIVE')
) AS e(tablename,policyname,qual,with_check,cmd,roles,permissive)
LEFT JOIN pg_catalog.pg_policies p ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
WHERE p.policyname IS NULL OR p.qual IS DISTINCT FROM e.qual OR p.with_check IS DISTINCT FROM e.with_check OR p.cmd IS DISTINCT FROM e.cmd OR p.roles::text IS DISTINCT FROM e.roles OR p.permissive IS DISTINCT FROM e.permissive) THEN
    RAISE EXCEPTION 'RLS baseline changed; review migration before applying';
  END IF;
END $guard$;
CREATE INDEX IF NOT EXISTS "idx_app_update_reads_user_id" ON public."app_update_reads" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_app_updates_created_by" ON public."app_updates" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON public."audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_bible_bookmarks_book_id" ON public."bible_bookmarks" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_bible_bookmarks_translation_code" ON public."bible_bookmarks" ("translation_code");
CREATE INDEX IF NOT EXISTS "idx_bible_completed_books_book_id" ON public."bible_completed_books" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_bible_highlights_book_id" ON public."bible_highlights" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_bible_highlights_translation_code" ON public."bible_highlights" ("translation_code");
CREATE INDEX IF NOT EXISTS "idx_bible_notes_book_id" ON public."bible_notes" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_bible_notes_translation_code" ON public."bible_notes" ("translation_code");
CREATE INDEX IF NOT EXISTS "idx_bible_reading_progress_book_id" ON public."bible_reading_progress" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_calendar_oauth_states_user_id" ON public."calendar_oauth_states" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_certificates_course_id" ON public."certificates" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_certificates_issued_by" ON public."certificates" ("issued_by");
CREATE INDEX IF NOT EXISTS "idx_certificates_user_id" ON public."certificates" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_community_comments_user_id" ON public."community_comments" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_community_posts_user_id" ON public."community_posts" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_community_reactions_user_id" ON public."community_reactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_course_lessons_module_id" ON public."course_lessons" ("module_id");
CREATE INDEX IF NOT EXISTS "idx_course_modules_course_id" ON public."course_modules" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_event_attendances_user_id" ON public."event_attendances" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_member_movements_created_by" ON public."member_movements" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_user_bible_preferences_last_book" ON public."user_bible_preferences" ("last_book");
CREATE INDEX IF NOT EXISTS "idx_user_bible_preferences_translation_code" ON public."user_bible_preferences" ("translation_code");
CREATE INDEX IF NOT EXISTS "idx_user_daily_challenges_challenge_id" ON public."user_daily_challenges" ("challenge_id");
CREATE INDEX IF NOT EXISTS "idx_user_lesson_progress_course_id" ON public."user_lesson_progress" ("course_id");
ALTER POLICY "app_update_reads_insert_own" ON public."app_update_reads" WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "app_update_reads_select_own" ON public."app_update_reads" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "community_comments_delete_own_or_master" ON public."community_comments" USING (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_comments_insert_own" ON public."community_comments" WITH CHECK (((user_id = (SELECT auth.uid())) AND (status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM community_posts p
  WHERE ((p.id = community_comments.post_id) AND (p.status = 'published'::text))))));
ALTER POLICY "community_comments_select_published" ON public."community_comments" USING (((status = 'published'::text) OR (user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_comments_update_own_or_admin" ON public."community_comments" USING (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master()))) WITH CHECK (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_posts_delete_own_or_master" ON public."community_posts" USING (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_posts_insert_own" ON public."community_posts" WITH CHECK (((user_id = (SELECT auth.uid())) AND (status = 'published'::text)));
ALTER POLICY "community_posts_select_published" ON public."community_posts" USING (((status = 'published'::text) OR (user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_posts_update_own_or_admin" ON public."community_posts" USING (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master()))) WITH CHECK (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_reactions_delete_own" ON public."community_reactions" USING (((user_id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "community_reactions_insert_own" ON public."community_reactions" WITH CHECK (((user_id = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM community_posts p
  WHERE ((p.id = community_reactions.post_id) AND (p.status = 'published'::text))))));
ALTER POLICY "Presenças - exclusão próprio usuário" ON public."event_attendances" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Presenças - inserção próprio usuário" ON public."event_attendances" WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "profiles_insert_self" ON public."profiles" WITH CHECK ((id = (SELECT auth.uid())));
ALTER POLICY "profiles_update_self_or_master" ON public."profiles" USING (((id = (SELECT auth.uid())) OR (SELECT public.is_admin_master()))) WITH CHECK (((id = (SELECT auth.uid())) OR (SELECT public.is_admin_master())));
ALTER POLICY "Progresso - exclusão própria" ON public."user_lesson_progress" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Progresso - inserção própria" ON public."user_lesson_progress" WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "Progresso - leitura própria" ON public."user_lesson_progress" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Usuários atualizam apenas seu próprio progresso" ON public."user_lesson_progress" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Usuários deletam apenas seu próprio progresso" ON public."user_lesson_progress" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Usuários inserem apenas seu próprio progresso" ON public."user_lesson_progress" WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "Usuários veem apenas seu próprio progresso" ON public."user_lesson_progress" USING (((SELECT auth.uid()) = user_id));
COMMIT;
