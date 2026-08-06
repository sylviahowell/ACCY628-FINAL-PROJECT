-- Feature showcase seed: ensure every role has live work on dashboards.
-- Idempotent. Preserves demo portal FKs (Midwest Retail / Prairie Haulers).
-- Run after story_seed_phase7.sql or against the live demo DB.

-- ---------------------------------------------------------------------------
-- Risk & Credit: force over-limit + watch customers; insurance stories
-- ---------------------------------------------------------------------------
UPDATE public.customers SET
  credit_limit = 1500,
  notes = 'SHOWCASE: Over credit limit — broker/manager Risk & Credit demo.'
WHERE id = '11111111-1111-1111-1111-111111111104'; -- Prairie Foods Co-op

UPDATE public.customers SET
  credit_limit = 2500,
  notes = 'SHOWCASE: Credit watch (≥80% utilization) for Risk & Credit.'
WHERE id = '11111111-1111-1111-1111-111111111105'; -- Summit Retail DC

UPDATE public.carriers SET
  insurance_expiration = DATE '2026-07-01',
  rating = 3.6
WHERE id = '22222222-2222-2222-2222-222222222204'; -- Midwest Reefer

UPDATE public.carriers SET
  insurance_expiration = (CURRENT_DATE + 12)
WHERE id = '22222222-2222-2222-2222-222222222203'; -- Pacific Lane

UPDATE public.contracts SET
  end_date = (CURRENT_DATE + 21),
  status = 'active',
  notes = 'SHOWCASE: Contract nearing expiration — renewals watch.'
WHERE contract_number = 'CTR-2026-002';

-- ---------------------------------------------------------------------------
-- Ops work queue: delayed, unassigned, needs POD, pickup today
-- ---------------------------------------------------------------------------
UPDATE public.shipments SET
  status = 'in_transit',
  promised_delivery_date = (CURRENT_DATE - 3),
  pickup_date = (CURRENT_DATE - 6),
  pickup_location = 'Chicago, IL',
  delivery_location = 'Atlanta, GA',
  customer_rate = 2800,
  carrier_cost = 2100,
  carrier_id = '22222222-2222-2222-2222-222222222201'
WHERE load_number = 'LD-1003';

UPDATE public.shipments SET
  status = 'in_transit',
  promised_delivery_date = (CURRENT_DATE - 5),
  carrier_id = '22222222-2222-2222-2222-222222222204',
  pickup_location = 'Columbus, OH',
  delivery_location = 'Nashville, TN'
WHERE load_number = 'LD-2010-LATE';

UPDATE public.shipments SET
  status = 'scheduled',
  carrier_id = NULL,
  carrier_cost = 0,
  pickup_date = CURRENT_DATE,
  promised_delivery_date = (CURRENT_DATE + 3),
  pickup_location = 'Houston, TX',
  delivery_location = 'Memphis, TN',
  customer_rate = 2200
WHERE load_number = 'LD-2014-OPEN';

UPDATE public.shipments SET
  status = 'delivered',
  delivery_date = (CURRENT_DATE - 1),
  promised_delivery_date = (CURRENT_DATE - 1),
  carrier_id = '22222222-2222-2222-2222-222222222201',
  customer_rate = 2600,
  carrier_cost = 2000,
  pickup_location = 'Chicago, IL',
  delivery_location = 'Dallas, TX'
WHERE load_number = 'LD-2021-NOPOD';

-- Carrier active assignment with pickup today
UPDATE public.shipments SET
  status = 'assigned',
  carrier_id = '22222222-2222-2222-2222-222222222201',
  pickup_date = CURRENT_DATE,
  promised_delivery_date = (CURRENT_DATE + 2),
  pickup_location = 'St. Louis, MO',
  delivery_location = 'Kansas City, MO',
  customer_rate = 1900,
  carrier_cost = 1500
WHERE load_number = 'LD-1004';

-- Manager credit-override narrative load
UPDATE public.shipments SET
  status = 'scheduled',
  carrier_id = NULL,
  customer_rate = 4200,
  carrier_cost = 0,
  pickup_date = (CURRENT_DATE + 2),
  promised_delivery_date = (CURRENT_DATE + 5),
  pickup_location = 'Des Moines, IA',
  delivery_location = 'Minneapolis, MN'
WHERE load_number = 'LD-2030-CREDIT';

DELETE FROM public.shipment_status_updates
WHERE shipment_id = (SELECT id FROM public.shipments WHERE load_number = 'LD-2030-CREDIT' LIMIT 1)
  AND note ILIKE 'Credit override%';

INSERT INTO public.shipment_status_updates (
  shipment_id, from_status, to_status, changed_by, note
)
SELECT id, NULL, status, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'Credit override: AR above limit — manager booked LD-2030-CREDIT for Prairie Foods Co-op demo.'
FROM public.shipments WHERE load_number = 'LD-2030-CREDIT'
LIMIT 1;

-- Delivered + POD ready to bill (LOSS lane)
UPDATE public.shipments SET
  status = 'delivered',
  delivery_date = (CURRENT_DATE - 3),
  promised_delivery_date = (CURRENT_DATE - 3),
  customer_rate = 1600,
  carrier_cost = 1950,
  carrier_id = '22222222-2222-2222-2222-222222222202'
WHERE load_number = 'LD-2011-LOSS';

INSERT INTO public.proof_of_delivery (id, shipment_id, signed_by, delivered_at, notes, uploaded_by, file_url)
SELECT
  '55555555-5555-5555-5555-555555555511',
  s.id,
  'Warehouse Dock',
  (CURRENT_DATE - 3)::timestamptz + interval '15 hours',
  'SHOWCASE POD — ready to bill',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  '/pod-samples/ld-2011.pdf'
FROM public.shipments s
WHERE s.load_number = 'LD-2011-LOSS'
ON CONFLICT (id) DO UPDATE SET
  shipment_id = EXCLUDED.shipment_id,
  notes = EXCLUDED.notes;

-- Accessorial pending approval on LD-2012-ACC
UPDATE public.shipments SET
  status = 'delivered',
  delivery_date = (CURRENT_DATE - 2),
  promised_delivery_date = (CURRENT_DATE - 2),
  carrier_id = '22222222-2222-2222-2222-222222222201'
WHERE load_number = 'LD-2012-ACC';

INSERT INTO public.proof_of_delivery (id, shipment_id, signed_by, delivered_at, notes, uploaded_by, file_url)
SELECT
  '55555555-5555-5555-5555-555555555512',
  s.id,
  'Receiver Jones',
  (CURRENT_DATE - 2)::timestamptz + interval '14 hours',
  'POD on file; detention pending approval',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  '/pod-samples/ld-2012.pdf'
FROM public.shipments s
WHERE s.load_number = 'LD-2012-ACC'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shipment_charges (
  id, shipment_id, charge_type, description, amount,
  billable_to_customer, payable_to_carrier, approval_status, requested_by
)
SELECT
  '66666666-6666-6666-6666-666666666612',
  s.id,
  'accessorial',
  'Detention at consignee — 4 hours',
  400,
  true, true, 'pending',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
FROM public.shipments s
WHERE s.load_number = 'LD-2012-ACC'
ON CONFLICT (id) DO UPDATE SET approval_status = 'pending', amount = 400;

INSERT INTO public.approval_requests (
  id, request_type, entity_type, entity_id, amount, reason, status, requested_by
) VALUES (
  '77777777-7777-7777-7777-777777777710',
  'accessorial', 'shipment_charge', '66666666-6666-6666-6666-666666666612',
  400,
  'Detention above threshold — needs manager approval',
  'pending',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
)
ON CONFLICT (id) DO UPDATE SET status = 'pending', amount = 400, reason = EXCLUDED.reason;

-- Discount approval pending for manager inbox
INSERT INTO public.approval_requests (
  id, request_type, entity_type, entity_id, amount, reason, status, requested_by
)
SELECT
  '77777777-7777-7777-7777-777777777711',
  'discount',
  'shipment',
  s.id,
  250,
  'SHOWCASE: Customer asked for $250 discount on LD-1004 — awaiting manager.',
  'pending',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
FROM public.shipments s
WHERE s.load_number = 'LD-1004'
ON CONFLICT (id) DO UPDATE SET status = 'pending', amount = 250, reason = EXCLUDED.reason;

-- ---------------------------------------------------------------------------
-- Coverage requests (shipper → broker)
-- ---------------------------------------------------------------------------
DELETE FROM public.coverage_requests
WHERE notes ILIKE 'SHOWCASE%' OR notes ILIKE '%C2C-%';

INSERT INTO public.coverage_requests (
  id, customer_id, requested_by, status,
  pickup_location, delivery_location, pickup_date, delivery_date,
  freight_type, weight_lbs, notes
) VALUES
(
  '88888888-8888-8888-8888-888888888801',
  '11111111-1111-1111-1111-111111111101',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'pending',
  'Milwaukee, WI', 'Indianapolis, IN',
  CURRENT_DATE + 3, CURRENT_DATE + 5,
  'Dry van', 24000,
  'SHOWCASE: Shipper needs coverage on Midwest lane — broker Book load.'
),
(
  '88888888-8888-8888-8888-888888888802',
  '11111111-1111-1111-1111-111111111101',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'pending',
  'Detroit, MI', 'Cleveland, OH',
  CURRENT_DATE + 1, CURRENT_DATE + 2,
  'Dry van', 18000,
  'SHOWCASE: Short-haul coverage request — scorecard assign after book.'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'pending',
  notes = EXCLUDED.notes,
  pickup_date = EXCLUDED.pickup_date,
  delivery_date = EXCLUDED.delivery_date;

-- ---------------------------------------------------------------------------
-- Billing: overdue AR, dispute, collection note, AP hold
-- ---------------------------------------------------------------------------
UPDATE public.invoices SET
  status = 'sent',
  due_date = (CURRENT_DATE - 18),
  amount_paid = 0
WHERE invoice_number IN ('INV-9001', 'INV-9002', 'INV-EDGE-OVERDUE');

-- Ensure an overdue invoice exists for Midwest
INSERT INTO public.invoices (
  id, invoice_number, customer_id, shipment_id, status,
  issue_date, due_date, subtotal, total, amount_paid
)
SELECT
  '99999999-9999-9999-9999-999999999901',
  'INV-SHOW-OVER',
  '11111111-1111-1111-1111-111111111101',
  s.id,
  'sent',
  CURRENT_DATE - 45,
  CURRENT_DATE - 15,
  3200, 3200, 0
FROM public.shipments s
WHERE s.load_number = 'LD-1001'
ON CONFLICT (id) DO UPDATE SET
  status = 'sent',
  due_date = CURRENT_DATE - 15,
  amount_paid = 0,
  total = 3200;

INSERT INTO public.disputes (
  id, invoice_id, shipment_id, customer_id, reason, amount_disputed, opened_by, status
) VALUES (
  'aaaa1111-bbbb-cccc-dddd-eeeeeeeeee01',
  '99999999-9999-9999-9999-999999999901',
  (SELECT id FROM public.shipments WHERE load_number = 'LD-1001' LIMIT 1),
  '11111111-1111-1111-1111-111111111101',
  'SHOWCASE: Shipper disputes detention line on INV-SHOW-OVER — billing to resolve.',
  400,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'open'
)
ON CONFLICT (id) DO UPDATE SET status = 'open', reason = EXCLUDED.reason, amount_disputed = 400;

UPDATE public.invoices SET status = 'disputed'
WHERE id = '99999999-9999-9999-9999-999999999901';

INSERT INTO public.collection_notes (invoice_id, note, created_by)
SELECT
  '99999999-9999-9999-9999-999999999901',
  'SHOWCASE: Called AP desk — awaiting dispute resolution before payment plan.',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'
WHERE NOT EXISTS (
  SELECT 1 FROM public.collection_notes
  WHERE invoice_id = '99999999-9999-9999-9999-999999999901'
    AND note ILIKE 'SHOWCASE:%'
);

-- AP hold on an open carrier bill
UPDATE public.carrier_bills SET status = 'on_hold'
WHERE bill_number = 'APB-9001'
   OR shipment_id = (SELECT id FROM public.shipments WHERE load_number = 'LD-1002' LIMIT 1);

-- Ensure a showcase-held bill exists (reuse LD-1002's unique active bill if present)
INSERT INTO public.carrier_bills (
  id, bill_number, carrier_id, shipment_id, status,
  issue_date, due_date, subtotal, total, amount_paid
)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'APB-SHOW-HOLD',
  s.carrier_id,
  s.id,
  'on_hold',
  CURRENT_DATE - 5,
  CURRENT_DATE + 10,
  COALESCE(s.carrier_cost, 1800),
  COALESCE(s.carrier_cost, 1800),
  0
FROM public.shipments s
WHERE s.load_number = 'LD-1002'
  AND s.carrier_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.carrier_bills cb
    WHERE cb.shipment_id = s.id AND cb.status <> 'cancelled'
  )
LIMIT 1;

UPDATE public.carrier_bills SET
  bill_number = CASE WHEN bill_number LIKE 'APB-%' THEN bill_number ELSE 'APB-SHOW-HOLD' END,
  status = 'on_hold'
WHERE shipment_id = (SELECT id FROM public.shipments WHERE load_number = 'LD-1002' LIMIT 1)
  AND status <> 'cancelled';

-- Deposit-style open invoice for shipper Mark paid demo (if none)
INSERT INTO public.invoices (
  id, invoice_number, customer_id, shipment_id, status,
  issue_date, due_date, subtotal, total, amount_paid
)
SELECT
  '99999999-9999-9999-9999-999999999902',
  'DEP-SHOW-DOWN',
  '11111111-1111-1111-1111-111111111101',
  s.id,
  'sent',
  CURRENT_DATE,
  CURRENT_DATE,
  520, 520, 0
FROM public.shipments s
WHERE s.load_number = 'LD-1004'
ON CONFLICT (id) DO UPDATE SET status = 'sent', amount_paid = 0, total = 520;

-- ---------------------------------------------------------------------------
-- Cleanup noisy interactive test leftovers (keep showcase / story loads)
-- ---------------------------------------------------------------------------
DELETE FROM public.carrier_payments
WHERE carrier_bill_id IN (
  SELECT id FROM public.carrier_bills
  WHERE shipment_id IN (
    SELECT id FROM public.shipments
    WHERE load_number LIKE 'LD-TEST%'
       OR load_number LIKE 'LD-CXL%'
       OR load_number LIKE 'LD-C2C-%'
       OR load_number LIKE 'LD-REQ-%'
  )
);

DELETE FROM public.carrier_bills
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
);

DELETE FROM public.payments
WHERE invoice_id IN (
  SELECT id FROM public.invoices
  WHERE invoice_number LIKE 'INV-SMOKE%'
     OR shipment_id IN (
       SELECT id FROM public.shipments
       WHERE load_number LIKE 'LD-TEST%'
          OR load_number LIKE 'LD-CXL%'
          OR load_number LIKE 'LD-C2C-%'
          OR load_number LIKE 'LD-REQ-%'
     )
);

DELETE FROM public.collection_notes
WHERE invoice_id IN (
  SELECT id FROM public.invoices
  WHERE shipment_id IN (
    SELECT id FROM public.shipments
    WHERE load_number LIKE 'LD-TEST%'
       OR load_number LIKE 'LD-CXL%'
       OR load_number LIKE 'LD-C2C-%'
       OR load_number LIKE 'LD-REQ-%'
  )
);

DELETE FROM public.disputes
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
)
OR invoice_id IN (
  SELECT id FROM public.invoices WHERE invoice_number LIKE 'INV-SMOKE%'
);

DELETE FROM public.invoices
WHERE invoice_number LIKE 'INV-SMOKE%'
   OR shipment_id IN (
     SELECT id FROM public.shipments
     WHERE load_number LIKE 'LD-TEST%'
        OR load_number LIKE 'LD-CXL%'
        OR load_number LIKE 'LD-C2C-%'
        OR load_number LIKE 'LD-REQ-%'
   );

DELETE FROM public.coverage_requests
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
)
OR notes ILIKE '%C2C-%';

DELETE FROM public.proof_of_delivery
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
);

DELETE FROM public.shipment_charges
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
);

DELETE FROM public.shipment_status_updates
WHERE shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%'
     OR load_number LIKE 'LD-CXL%'
     OR load_number LIKE 'LD-C2C-%'
     OR load_number LIKE 'LD-REQ-%'
);

DELETE FROM public.status_events
WHERE entity_type = 'shipment'
  AND entity_id IN (
    SELECT id FROM public.shipments
    WHERE load_number LIKE 'LD-TEST%'
       OR load_number LIKE 'LD-CXL%'
       OR load_number LIKE 'LD-C2C-%'
       OR load_number LIKE 'LD-REQ-%'
  );

DELETE FROM public.shipments
WHERE load_number LIKE 'LD-TEST%'
   OR load_number LIKE 'LD-CXL%'
   OR load_number LIKE 'LD-C2C-%'
   OR load_number LIKE 'LD-REQ-%';

-- ---------------------------------------------------------------------------
-- Support tickets (shipper + carrier + one resolved for staff filters)
-- Profiles: customer aaa…3 · carrier aaa…4 · broker aaa…2
-- ---------------------------------------------------------------------------
INSERT INTO public.support_tickets (
  id, ticket_number, created_by, customer_id, carrier_id,
  subject, category, priority, status, shipment_id,
  assigned_to, resolved_by, resolved_at, created_at, updated_at
) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'TKT-1001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  '11111111-1111-1111-1111-111111111101',
  NULL,
  'ETA update on delayed load LD-1003',
  'shipment',
  'high',
  'open',
  '44444444-4444-4444-4444-444444444403',
  NULL,
  NULL,
  NULL,
  now() - interval '6 hours',
  now() - interval '6 hours'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'TKT-1002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  NULL,
  '22222222-2222-2222-2222-222222222201',
  'Need clarification on POD photo requirements',
  'account',
  'normal',
  'pending',
  NULL,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  NULL,
  NULL,
  now() - interval '2 days',
  now() - interval '1 day'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
  'TKT-1003',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  '11111111-1111-1111-1111-111111111101',
  NULL,
  'Portal login hours / who to call after 6pm CT',
  'other',
  'low',
  'resolved',
  NULL,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  now() - interval '3 days',
  now() - interval '5 days',
  now() - interval '3 days'
)
ON CONFLICT (id) DO UPDATE SET
  subject = excluded.subject,
  status = excluded.status,
  category = excluded.category,
  priority = excluded.priority,
  assigned_to = excluded.assigned_to,
  resolved_by = excluded.resolved_by,
  resolved_at = excluded.resolved_at,
  updated_at = excluded.updated_at;

INSERT INTO public.support_ticket_messages (
  id, ticket_id, author_id, body, is_internal, created_at, author_display_name, author_role
)
VALUES
(
  'cccccccc-cccc-cccc-cccc-cccccccccc01',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'LD-1003 looks delayed past the promised delivery. Can ops confirm a revised ETA for our DC?',
  false,
  now() - interval '6 hours',
  'Casey Customer',
  'customer'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc02',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
  'Our drivers are uploading POD photos but the portal still shows Needs POD. What file types do you accept?',
  false,
  now() - interval '2 days',
  'Chris Carrier',
  'carrier'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc03',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'JPG or PNG under 10MB works. Re-upload from Documents → the load — if it still fails, reply here with the load number.',
  false,
  now() - interval '1 day',
  'Blake Broker',
  'broker'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc04',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Internal: Prairie Haulers often hits mobile compression — watch for HEIC rejects.',
  true,
  now() - interval '1 day',
  'Blake Broker',
  'broker'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc05',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'Is there an after-hours line for emergency freight issues?',
  false,
  now() - interval '5 days',
  'Casey Customer',
  'customer'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc06',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Yes — after 6pm CT call (312) 555-0199 and select option 1 for on-call ops. Tickets submitted here are monitored Mon–Fri 8am–6pm CT.',
  false,
  now() - interval '3 days',
  'Blake Broker',
  'broker'
)
ON CONFLICT (id) DO UPDATE SET
  body = excluded.body,
  is_internal = excluded.is_internal,
  author_display_name = excluded.author_display_name,
  author_role = excluded.author_role;
