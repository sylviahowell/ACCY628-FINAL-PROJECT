-- Harden RLS: prevent profile privilege escalation; narrow status history reads;
-- revoke anon execute on helper RPCs.
-- Applied to ACCY628-Final-Project via MCP as harden_rls_profiles_and_status_reads.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.current_role() IS DISTINCT FROM 'manager'::user_role THEN
    NEW.role := OLD.role;
    NEW.customer_id := OLD.customer_id;
    NEW.carrier_id := OLD.carrier_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_role()
  );

DROP POLICY IF EXISTS ssu_all_read ON public.shipment_status_updates;
CREATE POLICY ssu_read ON public.shipment_status_updates
  FOR SELECT TO authenticated
  USING (
    public.current_role() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role])
    OR shipment_id IN (
      SELECT s.id FROM public.shipments s
      WHERE s.customer_id = (SELECT p.customer_id FROM public.profiles p WHERE p.id = auth.uid())
         OR s.carrier_id = (SELECT p.carrier_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS status_events_select ON public.status_events;
CREATE POLICY status_events_select ON public.status_events
  FOR SELECT TO authenticated
  USING (
    public.current_role() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role, 'carrier'::user_role])
    OR (
      entity_type = 'shipment'
      AND entity_id IN (
        SELECT s.id FROM public.shipments s
        WHERE s.customer_id = (SELECT p.customer_id FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  );

REVOKE EXECUTE ON FUNCTION public.current_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.demo_network_snapshot() FROM anon;
