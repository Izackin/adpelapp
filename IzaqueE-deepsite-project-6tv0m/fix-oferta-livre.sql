-- ============================================================
-- FIX: Permitir ofertas livres (goal_id = null) em fundraising_contributions
-- ============================================================

-- Verificar se a constraint existe e removê-la
ALTER TABLE public.fundraising_contributions 
  ALTER COLUMN goal_id DROP NOT NULL;

-- Recarregar cache
NOTIFY pgrst, 'reload schema';

-- Verificação
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fundraising_contributions' 
  AND column_name = 'goal_id';