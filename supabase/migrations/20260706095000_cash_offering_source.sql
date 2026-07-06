-- ADPEL - Origem de ofertas do app no caixa da igreja.
-- Execute no Supabase para permitir conciliacao e evitar duplicidade.

alter table public.cash_movements
  add column if not exists source text,
  add column if not exists source_id uuid,
  add column if not exists payer_name text,
  add column if not exists payer_email text,
  add column if not exists payer_phone text,
  add column if not exists status text default 'confirmado';

create index if not exists cash_movements_source_idx
  on public.cash_movements(source, source_id);

create unique index if not exists cash_movements_source_unique_idx
  on public.cash_movements(source, source_id)
  where source is not null and source_id is not null;

drop policy if exists "cash_movements_app_offering_insert" on public.cash_movements;

create policy "cash_movements_app_offering_insert"
  on public.cash_movements for insert
  to authenticated
  with check (
    type = 'entrada'
    and amount > 0
    and created_by = auth.uid()
    and source in ('offering_app', 'fundraising_contribution')
  );

notify pgrst, 'reload schema';
