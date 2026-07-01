-- ============================================================
-- FIX: Corrigir tabelas para compatibilidade com admin.js
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar created_at na tabela verse_of_day (não existe no schema original)
ALTER TABLE public.verse_of_day ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. Adicionar file_url na tabela library_books (admin.js usa file_url)
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS file_url text;

-- 3. Recarregar cache do PostgREST (obrigatório após DDL)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICAÇÃO (execute separadamente para confirmar)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'verse_of_day' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'library_books' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'announcements' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'events' ORDER BY ordinal_position;