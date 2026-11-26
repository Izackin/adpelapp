BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.member_account_links (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);
ALTER TABLE public.member_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_account_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.member_account_links TO authenticated;
GRANT INSERT(member_id,user_id) ON public.member_account_links TO authenticated;
CREATE POLICY member_account_links_master_select ON public.member_account_links
  FOR SELECT TO authenticated USING ((SELECT public.is_admin_master()) IS TRUE);
CREATE POLICY member_account_links_master_insert ON public.member_account_links
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_master()) IS TRUE AND linked_by=(SELECT auth.uid()));
CREATE POLICY member_account_links_master_delete ON public.member_account_links
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_master()) IS TRUE);
CREATE INDEX member_account_links_linked_by_idx ON public.member_account_links(linked_by);
COMMIT;
