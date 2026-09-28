-- Teste transacional: não persiste posts, reações, notificações ou webhooks.
begin;

do $test$
declare
  v_owner_id uuid;
  v_actor_id uuid;
  v_post_id uuid := gen_random_uuid();
  v_comment_count integer;
  v_amen_count integer;
  v_webhook_queued boolean;
begin
  select p.id into v_owner_id
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at nulls last, p.id
  limit 1;

  select p.id into v_actor_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id <> v_owner_id
  order by p.created_at nulls last, p.id
  limit 1;

  if v_owner_id is null or v_actor_id is null then
    raise exception 'O teste precisa de dois usuários com perfil.';
  end if;

  insert into public.community_posts (id, user_id, content, category)
  values (v_post_id, v_owner_id, 'Teste transacional de notificações', 'reflexao');

  insert into public.community_comments (post_id, user_id, content)
  values (v_post_id, v_actor_id, 'Comentário de teste');

  select count(*) into v_comment_count
  from public.app_notifications n
  where n.recipient_id = v_owner_id
    and n.actor_id = v_actor_id
    and n.type = 'community_comment'
    and n.entity_id = v_post_id;
  if v_comment_count <> 1 then
    raise exception 'Comentário de terceiro deveria gerar 1 notificação; gerou %.', v_comment_count;
  end if;

  insert into public.community_comments (post_id, user_id, content)
  values (v_post_id, v_owner_id, 'Autocomentário de teste');

  select count(*) into v_comment_count
  from public.app_notifications n
  where n.recipient_id = v_owner_id
    and n.type = 'community_comment'
    and n.entity_id = v_post_id;
  if v_comment_count <> 1 then
    raise exception 'Autocomentário gerou notificação indevida.';
  end if;

  insert into public.community_reactions (post_id, user_id, reaction_type)
  values (v_post_id, v_actor_id, 'amen');

  select count(*) into v_amen_count
  from public.app_notifications n
  where n.recipient_id = v_owner_id
    and n.actor_id = v_actor_id
    and n.type = 'community_amen'
    and n.entity_id = v_post_id;
  if v_amen_count <> 1 then
    raise exception 'Amém de terceiro deveria gerar 1 notificação; gerou %.', v_amen_count;
  end if;

  delete from public.community_reactions
  where post_id = v_post_id and user_id = v_actor_id and reaction_type = 'amen';
  insert into public.community_reactions (post_id, user_id, reaction_type)
  values (v_post_id, v_actor_id, 'amen');

  select count(*) into v_amen_count
  from public.app_notifications n
  where n.recipient_id = v_owner_id
    and n.actor_id = v_actor_id
    and n.type = 'community_amen'
    and n.entity_id = v_post_id;
  if v_amen_count <> 1 then
    raise exception 'Amém repetido dentro da janela não foi deduplicado.';
  end if;

  insert into public.community_reactions (post_id, user_id, reaction_type)
  values (v_post_id, v_owner_id, 'amen');
  select count(*) into v_amen_count
  from public.app_notifications n
  where n.recipient_id = v_owner_id
    and n.type = 'community_amen'
    and n.entity_id = v_post_id;
  if v_amen_count <> 1 then
    raise exception 'Auto-Amém gerou notificação indevida.';
  end if;

  select exists (
    select 1
    from net.http_request_queue q
    where q.url = 'https://piqlrjzlepcpqootpyvq.supabase.co/functions/v1/send-user-notification'
      and q.headers ? 'x-adpel-webhook-secret'
      and char_length(q.headers ->> 'x-adpel-webhook-secret') >= 32
      and (convert_from(q.body, 'UTF8')::jsonb ->> 'type') = 'INSERT'
      and (convert_from(q.body, 'UTF8')::jsonb ->> 'table') = 'app_notifications'
  ) into v_webhook_queued;
  if not v_webhook_queued then
    raise exception 'Webhook direcionado não foi enfileirado.';
  end if;
end;
$test$;

rollback;
