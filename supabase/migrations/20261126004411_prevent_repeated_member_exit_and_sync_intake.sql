BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION adpel_private.apply_member_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE current_status text; next_status text;
BEGIN
 SELECT status INTO current_status FROM public.members WHERE id=NEW.member_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado ou sem acesso.' USING ERRCODE='P0001'; END IF;
 next_status:=CASE NEW.movement_type WHEN 'entrada' THEN 'ativo' WHEN 'retorno' THEN 'ativo' WHEN 'saida' THEN 'removido' WHEN 'transferencia' THEN 'transferido' WHEN 'afastamento' THEN 'afastado' WHEN 'falecimento' THEN 'falecido' ELSE NULL END;
 IF NEW.movement_type='saida' AND current_status='removido' THEN
   RAISE EXCEPTION 'Este membro já está arquivado. Não é necessário registrar outra saída.' USING ERRCODE='P0001';
 END IF;
 IF next_status IS NOT NULL AND current_status IS DISTINCT FROM next_status THEN
   UPDATE public.members SET status=next_status WHERE id=NEW.member_id;
 END IF;
 IF NEW.created_by IS NULL THEN NEW.created_by:=auth.uid(); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.apply_member_movement() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER adpel_apply_member_movement BEFORE INSERT ON public.member_movements FOR EACH ROW EXECUTE FUNCTION adpel_private.apply_member_movement();

CREATE FUNCTION adpel_private.close_archived_member_intake()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.status='removido' AND OLD.status IS DISTINCT FROM NEW.status THEN
   UPDATE public.member_registration_intakes SET followup_status='concluido' WHERE member_id=NEW.id AND followup_status<>'concluido';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.close_archived_member_intake() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER adpel_close_archived_member_intake AFTER UPDATE OF status ON public.members FOR EACH ROW EXECUTE FUNCTION adpel_private.close_archived_member_intake();

CREATE UNIQUE INDEX member_registration_intakes_one_member_idx ON public.member_registration_intakes(member_id) WHERE member_id IS NOT NULL;
CREATE FUNCTION adpel_private.sync_member_intake_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   UPDATE public.member_registration_intakes SET member_id=NULL,review_required=true
     WHERE user_id=OLD.user_id AND member_id=OLD.member_id;
   RETURN OLD;
 END IF;
 UPDATE public.member_registration_intakes i
   SET member_id=NEW.member_id,review_required=false,
       followup_status=CASE WHEN EXISTS(SELECT 1 FROM public.members m WHERE m.id=NEW.member_id AND m.status='removido') THEN 'concluido' ELSE i.followup_status END
   WHERE i.user_id=NEW.user_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION adpel_private.sync_member_intake_link() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER adpel_sync_member_intake_link AFTER INSERT OR DELETE ON public.member_account_links FOR EACH ROW EXECUTE FUNCTION adpel_private.sync_member_intake_link();
COMMIT;
