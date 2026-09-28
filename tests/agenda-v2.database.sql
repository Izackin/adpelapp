-- Validacao transacional da Agenda V2. Nenhum dado permanece em producao.
begin;

do $$
declare
  test_event_id uuid;
  test_user_id uuid;
begin
  insert into public.events (
    title, category, event_date, event_time, end_date, end_time,
    is_published, is_active, is_featured, source
  ) values (
    '[TESTE ROLLBACK] Agenda V2', 'evento', current_date + 1, '19:00',
    current_date + 2, '21:00', false, false, true, 'manual'
  ) returning id into test_event_id;

  if not exists (
    select 1 from public.events
    where id = test_event_id
      and source = 'manual'
      and is_published is false
      and is_active is false
      and is_featured is true
  ) then
    raise exception 'Evento manual da Agenda V2 não foi persistido corretamente';
  end if;

  begin
    insert into public.events (title, event_date, end_date, source)
    values ('[TESTE ROLLBACK] Intervalo inválido', current_date + 2, current_date + 1, 'manual');
    raise exception 'Constraint de intervalo não bloqueou a data inválida';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.events (title, event_date, source)
    values ('[TESTE ROLLBACK] Origem inválida', current_date + 1, 'outro');
    raise exception 'Constraint de origem não bloqueou o valor inválido';
  exception when check_violation then
    null;
  end;

  select id into test_user_id from auth.users order by created_at limit 1;
  if test_user_id is not null then
    insert into public.event_attendances (event_id, user_id, user_name)
    values (test_event_id, test_user_id, '[TESTE ROLLBACK] Participante');

    delete from public.events where id = test_event_id;
    if exists (select 1 from public.event_attendances where event_id = test_event_id) then
      raise exception 'ON DELETE CASCADE não removeu a confirmação de teste';
    end if;
  end if;
end $$;

rollback;
