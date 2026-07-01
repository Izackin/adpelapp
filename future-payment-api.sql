-- ============================================================
-- PREPARAÇÃO PARA API DE VERIFICAÇÃO DE PAGAMENTOS PIX
-- Execute quando for integrar com API de pagamento (ex: Mercado Pago, Efí, etc.)
-- ============================================================

-- Adicionar colunas para tracking de pagamento
ALTER TABLE public.fundraising_contributions 
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS payment_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Criar índice para busca por status
CREATE INDEX IF NOT EXISTS idx_contributions_payment_status 
  ON public.fundraising_contributions(payment_status);

-- Status possíveis: 'pending', 'confirmed', 'failed', 'refunded'

-- Comentário sobre uso futuro:
-- Quando o webhook de pagamento receber confirmação:
-- UPDATE public.fundraising_contributions 
--   SET payment_status = 'confirmed', 
--       payment_data = '{...dados do webhook...}',
--       confirmed_at = now()
--   WHERE id = 'uuid-da-contribuicao';

-- Recarregar cache
NOTIFY pgrst, 'reload schema';