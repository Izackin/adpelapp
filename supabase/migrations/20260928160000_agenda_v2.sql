-- ADPEL Digital - Agenda V2
-- Campos de periodo e origem, preparados para integracao futura com Google Calendar.

alter table public.events
  add column if not exists end_date date,
  add column if not exists end_time text,
  add column if not exists source text not null default 'manual',
  add column if not exists external_event_id text,
  add column if not exists external_calendar_id text;

alter table public.events
  drop constraint if exists events_source_check,
  add constraint events_source_check
    check (source in ('manual', 'google')),
  drop constraint if exists events_date_range_check,
  add constraint events_date_range_check
    check (end_date is null or event_date is null or end_date >= event_date);

create unique index if not exists events_google_external_event_unique_idx
  on public.events (external_calendar_id, external_event_id)
  where source = 'google'
    and external_calendar_id is not null
    and external_event_id is not null;

-- RLS existente continua definindo leitura publica e escrita exclusiva do Master.
alter table public.events enable row level security;
alter table public.event_attendances enable row level security;

-- Remove privilegios que nao possuem caso de uso no cliente. As policies
-- existentes continuam limitando insert/delete ao proprio usuario.
revoke all on table public.event_attendances from anon, authenticated;
grant select on table public.event_attendances to anon;
grant select, insert, delete on table public.event_attendances to authenticated;

comment on column public.events.source is
  'Origem do evento: manual no Admin; google reservado para integracao futura.';
comment on column public.events.external_event_id is
  'Identificador externo reservado para sincronizacao futura.';
comment on column public.events.external_calendar_id is
  'Identificador do calendario externo reservado para sincronizacao futura.';

notify pgrst, 'reload schema';
