# Reconciliacao do banco

Registro da reconciliacao executada em 2026-09-24. A fonte versionada do fluxo
Auth -> `profiles` e a migration
`20260924130216_reconcile_auth_profile_registration.sql`.

## Objetos remotos sem versao local

- `ia-chat`: funcao ativa, fora do escopo desta reconciliacao.
- `gerar-pix`: funcao financeira ativa, fora do escopo.
- `webhook-asaas`: funcao financeira ativa, fora do escopo.
- `send-notification`: funcao ativa e versionada em `supabase/functions`.

## SQLs manuais na raiz

- `schema.sql`: base historica; contem modelos antigos e nao deve ser executado
  sobre o banco ativo sem revisao.
- `fix-admin-tables.sql`: patch manual historico; requer revisao antes de uso.
- `fix-cache.sql`: operacao manual de recarga do cache do PostgREST, nao e fonte
  de schema.
- `schema-push-notifications.sql`: historico, superado por migrations e pelo
  hardening ativo.
- `spiritual-progress-schema.sql`: historico, representado pelas migrations de
  progresso.
- `church-management-schema.sql`: possivel schema ativo sem migration
  equivalente; requer reconciliacao futura especifica.
- `fundraising-schema.sql`, `fix-oferta-livre.sql` e `future-payment-api.sql`:
  financeiros e deliberadamente nao avaliados nem executados nesta etapa.

Nenhum desses arquivos deve ser executado em bloco no banco ativo. Eles foram
mantidos no lugar para preservar o historico.
