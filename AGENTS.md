<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Network shipment map (durable)

Map behavior is **code-owned**, not seed-owned:

- Trucks: any live `in_transit` / `picked_up` shipment with resolvable cities (`ShipmentMap` + `resolveTruckOnRoute`).
- Roads: `src/data/demo-route-polylines.json` + `/api/route-geometry` OSRM fallback.
- `vehicle_positions` is optional (popup speed / on-route snap). Map must still work if GPS seed is skipped.

When reseeding sample data: **do not** delete/revert `demo-route-polylines.json`, `ShipmentMap.tsx`, or `route-geometry.ts`. Prefer upserts by `load_number` for GPS rows (`supabase/seed_vehicle_positions_snapped.sql`).
