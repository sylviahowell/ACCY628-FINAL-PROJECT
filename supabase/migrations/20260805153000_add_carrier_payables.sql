-- Accounts payable: carrier bills + outbound payments
CREATE TABLE IF NOT EXISTS public.carrier_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL UNIQUE,
  carrier_id uuid NOT NULL REFERENCES public.carriers(id),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'on_hold'::text, 'cancelled'::text])),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS carrier_bills_one_active_per_shipment
  ON public.carrier_bills (shipment_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS carrier_bills_carrier_id_idx ON public.carrier_bills (carrier_id);
CREATE INDEX IF NOT EXISTS carrier_bills_due_date_idx ON public.carrier_bills (due_date);

CREATE TABLE IF NOT EXISTS public.carrier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_bill_id uuid NOT NULL REFERENCES public.carrier_bills(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'ach_simulated',
  reference text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carrier_payments_bill_id_idx ON public.carrier_payments (carrier_bill_id);

ALTER TABLE public.carrier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carrier_bills_staff ON public.carrier_bills;
CREATE POLICY carrier_bills_staff ON public.carrier_bills
  FOR ALL
  USING (public."current_role"() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role]))
  WITH CHECK (public."current_role"() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role]));

DROP POLICY IF EXISTS carrier_bills_carrier ON public.carrier_bills;
CREATE POLICY carrier_bills_carrier ON public.carrier_bills
  FOR SELECT
  USING (carrier_id = (SELECT profiles.carrier_id FROM profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS carrier_payments_staff ON public.carrier_payments;
CREATE POLICY carrier_payments_staff ON public.carrier_payments
  FOR ALL
  USING (public."current_role"() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role]))
  WITH CHECK (public."current_role"() = ANY (ARRAY['manager'::user_role, 'broker'::user_role, 'billing'::user_role]));

DROP POLICY IF EXISTS carrier_payments_carrier ON public.carrier_payments;
CREATE POLICY carrier_payments_carrier ON public.carrier_payments
  FOR SELECT
  USING (
    carrier_bill_id IN (
      SELECT cb.id FROM public.carrier_bills cb
      WHERE cb.carrier_id = (SELECT profiles.carrier_id FROM profiles WHERE profiles.id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_payments TO authenticated;
