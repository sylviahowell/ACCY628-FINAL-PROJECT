-- Seed 6 demo GPS trucks on showcase in-transit loads.
-- Idempotent. Run after story_seed_feature_showcase.sql / phase7.

-- Ensure known GPS demo lanes are in transit with hub cities
UPDATE public.shipments SET
  status = 'in_transit',
  pickup_location = 'Chicago, IL',
  delivery_location = 'Atlanta, GA',
  origin_city = 'Chicago',
  origin_state = 'IL',
  dest_city = 'Atlanta',
  dest_state = 'GA',
  carrier_id = coalesce(carrier_id, '22222222-2222-2222-2222-222222222201')
WHERE load_number = 'LD-1003';

UPDATE public.shipments SET
  status = 'in_transit',
  pickup_location = 'Columbus, OH',
  delivery_location = 'Nashville, TN',
  origin_city = 'Columbus',
  origin_state = 'OH',
  dest_city = 'Nashville',
  dest_state = 'TN',
  carrier_id = coalesce(carrier_id, '22222222-2222-2222-2222-222222222204')
WHERE load_number = 'LD-2010-LATE';

UPDATE public.shipments SET
  status = 'in_transit',
  pickup_location = 'Portland, OR',
  delivery_location = 'Phoenix, AZ',
  origin_city = 'Portland',
  origin_state = 'OR',
  dest_city = 'Phoenix',
  dest_state = 'AZ',
  pickup_date = coalesce(pickup_date, CURRENT_DATE - 1),
  promised_delivery_date = coalesce(promised_delivery_date, CURRENT_DATE + 2),
  carrier_id = coalesce(carrier_id, '22222222-2222-2222-2222-222222222203')
WHERE load_number = 'LD-2022-DISP';

UPDATE public.shipments SET
  status = 'in_transit',
  pickup_location = 'St. Louis, MO',
  delivery_location = 'Kansas City, MO',
  origin_city = 'St. Louis',
  origin_state = 'MO',
  dest_city = 'Kansas City',
  dest_state = 'MO',
  pickup_date = coalesce(pickup_date, CURRENT_DATE - 1),
  promised_delivery_date = coalesce(promised_delivery_date, CURRENT_DATE + 1),
  carrier_id = coalesce(carrier_id, '22222222-2222-2222-2222-222222222201')
WHERE load_number = 'LD-1004';

-- Dedicated GPS showcase loads (fixed UUIDs)
INSERT INTO public.shipments (
  id, load_number, customer_id, carrier_id, contract_id, status,
  origin_city, origin_state, dest_city, dest_state,
  pickup_location, delivery_location,
  pickup_date, delivery_date, promised_delivery_date,
  customer_rate, carrier_cost, created_by, freight_type, weight_lbs
) VALUES
(
  '44444444-4444-4444-4444-444444444430',
  'LD-GPS-01',
  '11111111-1111-1111-1111-111111111102',
  '22222222-2222-2222-2222-222222222201',
  NULL,
  'in_transit',
  'Houston', 'TX', 'Dallas', 'TX',
  'Houston, TX', 'Dallas, TX',
  CURRENT_DATE - 1, NULL, CURRENT_DATE + 1,
  1800, 1400,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 28000
),
(
  '44444444-4444-4444-4444-444444444431',
  'LD-GPS-02',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222202',
  NULL,
  'in_transit',
  'Omaha', 'NE', 'Kansas City', 'MO',
  'Omaha, NE', 'Kansas City, MO',
  CURRENT_DATE - 1, NULL, CURRENT_DATE + 1,
  1600, 1200,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 30000
),
(
  '44444444-4444-4444-4444-444444444432',
  'LD-GPS-03',
  '11111111-1111-1111-1111-111111111103',
  '22222222-2222-2222-2222-222222222203',
  NULL,
  'in_transit',
  'Denver', 'CO', 'Phoenix', 'AZ',
  'Denver, CO', 'Phoenix, AZ',
  CURRENT_DATE - 2, NULL, CURRENT_DATE + 1,
  2900, 2300,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 33000
),
(
  '44444444-4444-4444-4444-444444444433',
  'LD-GPS-04',
  '11111111-1111-1111-1111-111111111105',
  '22222222-2222-2222-2222-222222222201',
  NULL,
  'picked_up',
  'Dallas', 'TX', 'Houston', 'TX',
  'Dallas, TX', 'Houston, TX',
  CURRENT_DATE, NULL, CURRENT_DATE + 1,
  1500, 1100,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'Dry Van', 25000
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  carrier_id = EXCLUDED.carrier_id,
  pickup_location = EXCLUDED.pickup_location,
  delivery_location = EXCLUDED.delivery_location,
  origin_city = EXCLUDED.origin_city,
  origin_state = EXCLUDED.origin_state,
  dest_city = EXCLUDED.dest_city,
  dest_state = EXCLUDED.dest_state,
  pickup_date = EXCLUDED.pickup_date,
  promised_delivery_date = EXCLUDED.promised_delivery_date,
  customer_rate = EXCLUDED.customer_rate,
  carrier_cost = EXCLUDED.carrier_cost;

-- Initial positions (approx mid-route placeholders; app advances along OSRM paths)
INSERT INTO public.vehicle_positions (
  shipment_id, lat, lng, speed_mph, heading_deg, source, recorded_at, updated_at
)
SELECT s.id, v.lat, v.lng, v.speed_mph, v.heading_deg, 'demo_seed', now(), now()
FROM (VALUES
  ('LD-1003', 38.45, -86.20, 62.0, 160.0),
  ('LD-2010-LATE', 37.90, -85.10, 58.0, 210.0),
  ('LD-2022-DISP', 40.10, -116.80, 61.0, 155.0),
  ('LD-1004', 38.85, -92.40, 55.0, 280.0),
  ('LD-GPS-01', 30.90, -96.00, 64.0, 350.0),
  ('LD-GPS-02', 40.55, -95.20, 60.0, 170.0),
  ('LD-GPS-03', 36.80, -108.50, 55.0, 210.0),
  ('LD-GPS-04', 31.20, -96.20, 59.0, 160.0)
) AS v(load_number, lat, lng, speed_mph, heading_deg)
JOIN public.shipments s ON s.load_number = v.load_number
ON CONFLICT (shipment_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  speed_mph = EXCLUDED.speed_mph,
  heading_deg = EXCLUDED.heading_deg,
  source = 'demo_seed',
  recorded_at = now(),
  updated_at = now();
