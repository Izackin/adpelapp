BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.app_notifications ADD COLUMN dismissed_at timestamptz;
GRANT UPDATE(dismissed_at) ON public.app_notifications TO authenticated;
CREATE INDEX app_notifications_visible_recipient_created_idx ON public.app_notifications(recipient_id,created_at DESC,id DESC) WHERE dismissed_at IS NULL;
COMMIT;
