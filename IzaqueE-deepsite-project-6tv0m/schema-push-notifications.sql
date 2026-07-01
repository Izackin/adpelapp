-- ============================================================
-- PUSH NOTIFICATIONS - Schema para ADPEL
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de inscrições Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Push subs - leitura pública"
  ON public.push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Push subs - inserção autenticada"
  ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Push subs - exclusão própria"
  ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 2. Recarregar cache
NOTIFY pgrst, 'reload schema';