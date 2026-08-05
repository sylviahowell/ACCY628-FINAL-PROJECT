-- Phase 7: Story-driven demo seed for RowanLane
-- Idempotent where practical. Preserves demo portal user FKs:
--   customer@ → Midwest Retail Group (1111...101)
--   carrier@  → Prairie Haulers LLC (2222...201)
-- Fake companies only. Safe to re-run after smoke cleanup.

-- ---------------------------------------------------------------------------
-- 0) Remove interactive smoke/test clutter (keeps narrative LD-100x / LD-201x)
-- ---------------------------------------------------------------------------
DELETE FROM public.payments
WHERE invoice_id IN (
  SELECT id FROM public.invoices WHERE invoice_number LIKE 'INV-SMOKE%'
);

DELETE FROM public.collection_notes
WHERE invoice_id IN (
  SELECT id FROM public.invoices WHERE invoice_number LIKE 'INV-SMOKE%'
);

DELETE FROM public.disputes
WHERE invoice_id IN (
  SELECT id FROM public.invoices WHERE invoice_number LIKE 'INV-SMOKE%'
)
OR shipment_id IN (
  SELECT id FROM public.shipments
  WHERE load_number LIKE 'LD-TEST%' OR load_number LIKE 'LD-CXL%'
);

DELETE FROM public.invoices WHERE invoice_number LIKE 'INV-SMOKE%';

DELETE FROM public.approval_requests
WHERE entity_id IN (
  SELECT id FROM public.shipment_charges
  WHERE shipment_id IN (
    SELECT id FROM public.shipments
    WHERE load_number LIKE 'LD-TEST%' OR load_number LIKE 'LD-CXL%'
  )
);

DELETE FROM public.shipments
WHERE load_number LIKE 'LD-TEST%' OR load_number LIKE 'LD-CXL%';

-- ---------------------------------------------------------------------------
-- 1) Customer personas (A–D + coop)
-- ---------------------------------------------------------------------------
UPDATE public.customers SET
  payment_terms = 'Net 45',
  credit_limit = 90000,
  notes = 'STORY A: High shipment volume, strong revenue, thin margins, slow to pay. Demo shipper portal account.'
WHERE id = '11111111-1111-1111-1111-111111111101';

UPDATE public.customers SET
  payment_terms = 'Net 15',
  credit_limit = 60000,
  notes = 'STORY B: Lower volume, healthy margins, pays quickly. Preferred lane partner.'
WHERE id = '11111111-1111-1111-1111-111111111102';

UPDATE public.customers SET
  payment_terms = 'Net 30',
  credit_limit = 45000,
  notes = 'STORY C: Frequent billing disputes and accessorials. Contract renewal pressure.'
WHERE id = '11111111-1111-1111-1111-111111111103';

UPDATE public.customers SET
  payment_terms = 'Net 15',
  credit_limit = 25000,
  notes = 'STORY edge: Smaller co-op; occasional unprofitable lanes.'
WHERE id = '11111111-1111-1111-1111-111111111104';

UPDATE public.customers SET
  payment_terms = 'Net 45',
  credit_limit = 80000,
  notes = 'STORY D: Rapid growth, rising buy rates, credit utilization watch. Large DC network.'
WHERE id = '11111111-1111-1111-1111-111111111105';

-- ---------------------------------------------------------------------------
-- 2) Carrier personas
-- ---------------------------------------------------------------------------
UPDATE public.carriers SET
  rating = 4.8,
  insurance_expiration = DATE '2027-06-30',
  equipment_type = 'Dry Van',
  service_area = 'Midwest / Southeast',
  contact_name = COALESCE(contact_name, 'Dispatch Desk')
WHERE id = '22222222-2222-2222-2222-222222222201'; -- Prairie — Preferred

UPDATE public.carriers SET
  rating = 3.4,
  insurance_expiration = DATE '2027-03-01',
  equipment_type = 'Dry Van',
  service_area = 'Midwest / South',
  contact_name = COALESCE(contact_name, 'Ops')
WHERE id = '22222222-2222-2222-2222-222222222202'; -- Blue Ridge — Watch (delays / accessorials)

UPDATE public.carriers SET
  rating = 4.1,
  insurance_expiration = (CURRENT_DATE + 18),
  equipment_type = 'Dry Van',
  service_area = 'West / Midwest',
  contact_name = COALESCE(contact_name, 'Safety')
WHERE id = '22222222-2222-2222-2222-222222222203'; -- Pacific — insurance expiring soon

UPDATE public.carriers SET
  rating = 3.6,
  insurance_expiration = DATE '2026-07-01', -- expired (Suspended warning)
  equipment_type = 'Reefer',
  service_area = 'Midwest',
  contact_name = COALESCE(contact_name, 'Reefer Desk')
WHERE id = '22222222-2222-2222-2222-222222222204'; -- Midwest Reefer — expired insurance + delays

-- ---------------------------------------------------------------------------
-- 3) Contracts: renewal soon + expired story
-- ---------------------------------------------------------------------------
UPDATE public.contracts SET
  end_date = (CURRENT_DATE + 28),
  status = 'active',
  notes = 'Nearing expiration — schedule renewal with shipper.'
WHERE contract_number = 'CTR-2026-002';

UPDATE public.contracts SET
  notes = 'Expired master — renewal discussion needed.'
WHERE contract_number = 'CTR-2025-014';

-- ---------------------------------------------------------------------------
-- 4) Tighten narrative on existing story loads
-- ---------------------------------------------------------------------------
-- Delayed in-transit on Midwest Retail (customer portal)
UPDATE public.shipments SET
  status = 'in_transit',
  promised_delivery_date = (CURRENT_DATE - 2),
  pickup_date = (CURRENT_DATE - 5),
  pickup_location = 'Chicago, IL',
  delivery_location = 'Atlanta, GA',
  origin_city = 'Chicago', origin_state = 'IL',
  dest_city = 'Atlanta', dest_state = 'GA',
  customer_rate = 2800, carrier_cost = 2100
WHERE load_number = 'LD-1003';

-- Late load on Summit with expired-insurance carrier (broker watch)
UPDATE public.shipments SET
  status = 'in_transit',
  promised_delivery_date = (CURRENT_DATE - 5),
  pickup_date = (CURRENT_DATE - 8),
  pickup_location = 'Columbus, OH',
  delivery_location = 'Nashville, TN',
  origin_city = 'Columbus', origin_state = 'OH',
  dest_city = 'Nashville', dest_state = 'TN'
WHERE load_number = 'LD-2010-LATE';

-- Unassigned coverage need
UPDATE public.shipments SET
  status = 'scheduled',
  carrier_id = NULL,
  carrier_cost = 0,
  pickup_date = (CURRENT_DATE + 1),
  promised_delivery_date = (CURRENT_DATE + 4),
  pickup_location = 'Houston, TX',
  delivery_location = 'Memphis, TN',
  origin_city = 'Houston', origin_state = 'TX',
  dest_city = 'Memphis', dest_state = 'TN'
WHERE load_number = 'LD-2014-OPEN';

-- Delivered + POD + unbilled (billing ready queue) — LOSS lane
UPDATE public.shipments SET
  status = 'delivered',
  delivery_date = (CURRENT_DATE - 4),
  promised_delivery_date = (CURRENT_DATE - 5),
  pickup_location = 'Omaha, NE',
  delivery_location = 'Chicago, IL',
  origin_city = 'Omaha', origin_state = 'NE',
  dest_city = 'Chicago', dest_state = 'IL',
  customer_rate = 1600, carrier_cost = 1950
WHERE load_number = 'LD-2011-LOSS';

-- Accessorial pending approval (unbilled)
UPDATE public.shipments SET
  status = 'delivered',
  delivery_date = (CURRENT_DATE - 2),
  promised_delivery_date = (CURRENT_DATE - 2),
  pickup_location = 'Dallas, TX',
  delivery_location = 'Memphis, TN',
  origin_city = 'Dallas', origin_state = 'TX',
  dest_city = 'Memphis', dest_state = 'TN'
WHERE load_number = 'LD-2012-ACC';

-- ---------------------------------------------------------------------------
-- 5) New story loads (fixed UUIDs)
-- ---------------------------------------------------------------------------
INSERT INTO public.shipments (
  id, load_number, customer_id, carrier_id, contract_id, status,
  origin_city, origin_state, dest_city, dest_state,
  pickup_location, delivery_location,
  pickup_date, delivery_date, promised_delivery_date,
  customer_rate, carrier_cost, created_by, freight_type, weight_lbs
) VALUES
-- Profitable completed+paid narrative for Gulf Coast (Customer B)
(
  '44444444-4444-4444-4444-444444444420',
  'LD-2020-WIN',
  '11111111-1111-1111-1111-111111111102',
  '22222222-2222-2222-2222-222222222201',
  (SELECT id FROM public.contracts WHERE contract_number = 'CTR-2026-002' LIMIT 1),
  'completed',
  'Houston', 'TX', 'Denver', 'CO',
  'Houston, TX', 'Denver, CO',
  CURRENT_DATE - 20, CURRENT_DATE - 16, CURRENT_DATE - 16,
  3400, 2400,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 32000
),
-- Delivered, missing POD (carrier document task)
(
  '44444444-4444-4444-4444-444444444421',
  'LD-2021-NOPOD',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  (SELECT id FROM public.contracts WHERE contract_number = 'CTR-2026-001' LIMIT 1),
  'delivered',
  'Chicago', 'IL', 'Dallas', 'TX',
  'Chicago, IL', 'Dallas, TX',
  CURRENT_DATE - 3, CURRENT_DATE - 1, CURRENT_DATE - 1,
  2600, 2000,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 28000
),
-- Cascade dispute-prone customer growth lane (Customer C / D mix) — assigned for broker
(
  '44444444-4444-4444-4444-444444444422',
  'LD-2022-DISP',
  '11111111-1111-1111-1111-111111111103',
  '22222222-2222-2222-2222-222222222202',
  NULL,
  'picked_up',
  'Portland', 'OR', 'Phoenix', 'AZ',
  'Portland, OR', 'Phoenix, AZ',
  CURRENT_DATE - 1, NULL, CURRENT_DATE + 3,
  3100, 2700,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 35000
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  carrier_id = EXCLUDED.carrier_id,
  customer_rate = EXCLUDED.customer_rate,
  carrier_cost = EXCLUDED.carrier_cost,
  pickup_date = EXCLUDED.pickup_date,
  delivery_date = EXCLUDED.delivery_date,
  promised_delivery_date = EXCLUDED.promised_delivery_date,
  pickup_location = EXCLUDED.pickup_location,
  delivery_location = EXCLUDED.delivery_location;

-- Ensure PODs on loads that should be billing-ready
INSERT INTO public.proof_of_delivery (id, shipment_id, signed_by, delivered_at, notes, uploaded_by, file_url)
VALUES
  (
    '55555555-5555-5555-5555-555555555511',
    '44444444-4444-4444-4444-444444444411',
    'Warehouse Dock',
    (CURRENT_DATE - 4)::timestamptz + interval '16 hours',
    'POD on file — load ready for billing review',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'https://docs.rowanlane.com/pod/ld-2011.pdf'
  ),
  (
    '55555555-5555-5555-5555-555555555512',
    '44444444-4444-4444-4444-444444444412',
    'Receiver Jones',
    (CURRENT_DATE - 2)::timestamptz + interval '14 hours',
    'POD on file; detention accessorial pending approval',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'https://docs.rowanlane.com/pod/ld-2012.pdf'
  ),
  (
    '55555555-5555-5555-5555-555555555520',
    '44444444-4444-4444-4444-444444444420',
    'DC Clerk',
    (CURRENT_DATE - 16)::timestamptz + interval '12 hours',
    'Clean delivery — signed BOL attached',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'https://docs.rowanlane.com/pod/ld-2020.pdf'
  )
ON CONFLICT (id) DO NOTHING;

-- LD-1001 stays WITHOUT POD but invoiced (control exception seed)
-- LD-2021-NOPOD deliberately has no POD row

-- Accessorial pending on LD-2012
INSERT INTO public.shipment_charges (
  id, shipment_id, charge_type, description, amount,
  billable_to_customer, payable_to_carrier, approval_status, requested_by
) VALUES (
  '66666666-6666-6666-6666-666666666612',
  '44444444-4444-4444-4444-444444444412',
  'accessorial',
  'Detention at consignee — 4 hours',
  400,
  true, true, 'pending',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
)
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
ON CONFLICT (id) DO UPDATE SET status = 'pending', amount = 400;

-- Cost recorded after invoice on LD-2013-OVER (already invoiced)
INSERT INTO public.shipment_charges (
  id, shipment_id, charge_type, description, amount,
  billable_to_customer, payable_to_carrier, approval_status, requested_by
) VALUES (
  '66666666-6666-6666-6666-666666666613',
  '44444444-4444-4444-4444-444444444413',
  'accessorial',
  'Lumper added after customer invoiced',
  175,
  true, true, 'approved',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
)
ON CONFLICT (id) DO NOTHING;

-- Profitable WIN invoice + payment (Customer B fast pay)
INSERT INTO public.invoices (
  id, invoice_number, customer_id, shipment_id, status,
  issue_date, due_date, subtotal, total, amount_paid
) VALUES (
  '88888888-8888-8888-8888-888888888820',
  'INV-2020-WIN',
  '11111111-1111-1111-1111-111111111102',
  '44444444-4444-4444-4444-444444444420',
  'paid',
  CURRENT_DATE - 15,
  CURRENT_DATE - 1,
  3400, 3400, 3400
)
ON CONFLICT (invoice_number) DO UPDATE SET
  status = 'paid', amount_paid = 3400, total = 3400;

INSERT INTO public.payments (
  id, invoice_id, amount, payment_date, method, reference, recorded_by
) VALUES (
  '99999999-9999-9999-9999-999999999920',
  '88888888-8888-8888-8888-888888888820',
  3400,
  CURRENT_DATE - 2,
  'ach_simulated',
  'STORY-B-FAST-PAY',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'
)
ON CONFLICT (id) DO NOTHING;

-- Ensure open dispute story on disputed invoice (INV-9003)
INSERT INTO public.disputes (
  id, invoice_id, shipment_id, customer_id, reason, amount_disputed, status, opened_by
)
SELECT
  'aaaa1111-bbbb-cccc-dddd-eeeeeeeeee01',
  i.id,
  i.shipment_id,
  i.customer_id,
  'Customer disputes accessorial / detention amount',
  125,
  'open',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
FROM public.invoices i
WHERE i.invoice_number = 'INV-9003'
ON CONFLICT (id) DO UPDATE SET status = 'open', reason = EXCLUDED.reason;

-- Cascade-facing dispute document on their cancelled history: mark a staff note via contract
-- (Story C pressure already covered by expired CTR-2025-014 + LD-2022-DISP)

-- Collection note on overdue edge invoice
INSERT INTO public.collection_notes (id, invoice_id, note, created_by)
SELECT
  'bbbb2222-cccc-dddd-eeee-ffffffffff01',
  i.id,
  'Left voicemail with AP — promised remittance by Friday.',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5'
FROM public.invoices i
WHERE i.invoice_number = 'INV-EDGE-OVERDUE'
ON CONFLICT (id) DO NOTHING;

-- Status history breadcrumbs for timeline demos
INSERT INTO public.shipment_status_updates (shipment_id, from_status, to_status, note, changed_by)
SELECT '44444444-4444-4444-4444-444444444403', 'assigned', 'picked_up', 'Pickup confirmed', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipment_status_updates
  WHERE shipment_id = '44444444-4444-4444-4444-444444444403' AND to_status = 'picked_up'
);

INSERT INTO public.shipment_status_updates (shipment_id, from_status, to_status, note, changed_by)
SELECT '44444444-4444-4444-4444-444444444403', 'picked_up', 'in_transit', 'Rolling to Atlanta — delayed en route', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipment_status_updates
  WHERE shipment_id = '44444444-4444-4444-4444-444444444403' AND to_status = 'in_transit'
);

INSERT INTO public.shipment_status_updates (shipment_id, from_status, to_status, note, changed_by)
SELECT '44444444-4444-4444-4444-444444444421', 'in_transit', 'delivered', 'Delivered — POD still missing', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipment_status_updates
  WHERE shipment_id = '44444444-4444-4444-4444-444444444421' AND to_status = 'delivered'
);
