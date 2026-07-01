-- ============================================================
-- FIX: Recarregar cache do PostgREST após DDL/RLS
-- Execute isto no SQL Editor e aguarde 2-3 segundos
-- ============================================================

-- 1. Forçar reload imediato do schema cache
NOTIFY pgrst, 'reload schema';

-- 2. (Opcional) Verificar se as tabelas e políticas foram criadas corretamente
SELECT
  schemaname,
  tablename,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('courses','studies','library_books','announcements','events','certificates','home_sections','profiles')
ORDER BY tablename;

-- 3. (Opcional) Listar políticas RLS ativas para conferência
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;