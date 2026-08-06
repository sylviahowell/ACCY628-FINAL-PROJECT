-- Current vehicle lat/lng per shipment (demo telemetry; swap writers for real ELD later).
CREATE TABLE IF NOT EXISTS public.vehicle_positions (
  shipment_id uuid PRIMARY KEY REFERENCES public.shipments(id) ON DELETE CASCADE,
  lat double precision NOT NULL
    CHECK (lat >= -90::double precision AND lat <= 90::double precision),
  lng double precision NOT NULL
    CHECK (lng >= -180::double precision AND lng <= 180::double precision),
  speed_mph numeric NOT NULL DEFAULT 0
    CHECK (speed_mph >= 0 AND speed_mph <= 120),
  heading_deg numeric NULL,
  source text NOT NULL DEFAULT 'demo_seed',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_positions IS
  'Current vehicle lat/lng per shipment. Demo seed telemetry today; swap writers for real ELD later.';

ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_positions_staff_select ON public.vehicle_positions;
CREATE POLICY vehicle_positions_staff_select ON public.vehicle_positions
  FOR SELECT TO authenticated
  USING (
    public.current_role() = ANY (
      ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role]
    )
  );

DROP POLICY IF EXISTS vehicle_positions_carrier_select ON public.vehicle_positions;
CREATE POLICY vehicle_positions_carrier_select ON public.vehicle_positions
  FOR SELECT TO authenticated
  USING (
    public.current_role() = 'carrier'::user_role
    AND shipment_id IN (
      SELECT s.id
      FROM public.shipments s
      WHERE s.carrier_id = (
        SELECT p.carrier_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS vehicle_positions_staff_write ON public.vehicle_positions;
CREATE POLICY vehicle_positions_staff_write ON public.vehicle_positions
  FOR ALL TO authenticated
  USING (
    public.current_role() = ANY (ARRAY['manager'::user_role, 'broker'::user_role])
  )
  WITH CHECK (
    public.current_role() = ANY (ARRAY['manager'::user_role, 'broker'::user_role])
  );
