-- On-route vehicle_positions helper (optional telemetry for map popups).
-- SAFE FOR RESEED: only upserts rows for shipments that already exist (by load_number).
-- Does NOT invent shipment UUIDs. Network map trucks work from live shipments even if
-- this file is skipped — see src/lib/route-geometry.ts resolveTruckOnRoute.
--
-- DO NOT delete or overwrite src/data/demo-route-polylines.json when reseeding sample data.
-- Map road geometry + truck placement are code-owned (ShipmentMap + route-geometry).

INSERT INTO public.vehicle_positions (
  shipment_id, lat, lng, speed_mph, heading_deg, source, recorded_at, updated_at
)
SELECT s.id, v.lat, v.lng, v.speed_mph, v.heading_deg, 'demo_snapped', now(), now()
FROM (
  VALUES
    ('LD-1003', 40.904266712954566, -87.2122663915924, 62::numeric, 150.64::numeric),
    ('LD-2010-LATE', 38.946315291392125, -84.63804733097652, 58::numeric, 171.19::numeric),
    ('LD-1004', 38.82153887395754, -91.16732295860898, 55::numeric, 266.72::numeric),
    ('LD-2022-DISP', 37.8388110343501, -121.28902304115593, 61::numeric, 192.49::numeric),
    ('LD-GPS-01', 31.46802031561557, -96.0771063282215, 64::numeric, 327.92::numeric),
    ('LD-GPS-02', 39.92030626454244, -94.90329259801427, 60::numeric, 124.29::numeric),
    ('LD-GPS-03', 36.00049206392591, -111.41243069087001, 55::numeric, 195.25::numeric),
    ('LD-GPS-04', 30.175010050951546, -95.43520333774345, 59::numeric, 171.04::numeric)
) AS v(load_number, lat, lng, speed_mph, heading_deg)
JOIN public.shipments s ON s.load_number = v.load_number
ON CONFLICT (shipment_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  speed_mph = EXCLUDED.speed_mph,
  heading_deg = EXCLUDED.heading_deg,
  source = EXCLUDED.source,
  recorded_at = EXCLUDED.recorded_at,
  updated_at = EXCLUDED.updated_at;
