-- ============================================================
-- ADPEL Digital - Cofres de Objetivos (Fundraising)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de Cofres/Objetivos
CREATE TABLE IF NOT EXISTS public.fundraising_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fundraising_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cofres - leitura pública"
  ON public.fundraising_goals FOR SELECT USING (true);
CREATE POLICY "Cofres - inserção autenticada"
  ON public.fundraising_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Cofres - atualização autenticada"
  ON public.fundraising_goals FOR UPDATE USING (true);
CREATE POLICY "Cofres - exclusão autenticada"
  ON public.fundraising_goals FOR DELETE USING (true);

-- 2. Tabela de Contribuições
CREATE TABLE IF NOT EXISTS public.fundraising_contributions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid REFERENCES public.fundraising_goals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fundraising_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contribuições - leitura pública"
  ON public.fundraising_contributions FOR SELECT USING (true);
CREATE POLICY "Contribuições - inserção autenticada"
  ON public.fundraising_contributions FOR INSERT WITH CHECK (true);
CREATE POLICY "Contribuições - atualização autenticada"
  ON public.fundraising_contributions FOR UPDATE USING (true);
CREATE POLICY "Contribuições - exclusão autenticada"
  ON public.fundraising_contributions FOR DELETE USING (true);

-- 3. View de Estatísticas (NUNCA editar current_amount manualmente!)
CREATE OR REPLACE VIEW public.fundraising_stats AS
SELECT
  g.id AS goal_id,
  g.name,
  g.description,
  g.target_amount,
  g.image_url,
  g.end_date,
  g.is_active,
  g.created_at,
  COALESCE(SUM(c.amount), 0) AS current_amount,
  COUNT(c.id) AS contributor_count
FROM public.fundraising_goals g
LEFT JOIN public.fundraising_contributions c ON c.goal_id = g.id
GROUP BY g.id;

-- Permissão para a view
GRANT SELECT ON public.fundraising_stats TO anon, authenticated;

-- 4. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';