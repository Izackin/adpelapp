-- ADPEL - Unificacao de ofertas livres e destinadas.
create table if not exists public.fundraising_stats (
  goal_id uuid primary key references public.fundraising_goals(id) on delete cascade,
  current_amount numeric default 0,
  contributor_count integer default 0,
  updated_at timestamp default now()
);

alter table public.fundraising_contributions
add column if not exists contribution_type text default 'destinada',
add column if not exists status text default 'confirmed',
add column if not exists receipt_code text,
add column if not exists paid_at timestamp default now();

update public.fundraising_contributions
set contribution_type = case when goal_id is null then 'livre' else 'destinada' end
where contribution_type is null
   or contribution_type not in ('livre', 'destinada');

update public.fundraising_contributions
set status = 'confirmed'
where status is null;

update public.fundraising_contributions
set paid_at = coalesce(paid_at, created_at, now())
where paid_at is null;

create or replace view public.user_offering_summary as
select
  user_id,
  sum(amount) filter (where created_at >= date_trunc('week', now())) as week_total,
  sum(amount) filter (where created_at >= date_trunc('month', now())) as month_total,
  sum(amount) filter (where created_at >= date_trunc('year', now())) as year_total,
  sum(amount) as total
from public.fundraising_contributions
where status = 'confirmed'
group by user_id;
