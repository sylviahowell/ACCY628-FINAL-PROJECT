"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeDemoPosition,
  fleetSpecForLoad,
  pathForShipment,
} from "@/lib/vehicle-positions";

type AdvanceInput = {
  id: string;
  load_number: string;
  origin_city: string | null;
  origin_state: string | null;
  dest_city: string | null;
  dest_state: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
};

/**
 * Advance demo_seed rows along cached highway geometry at cruise mph
 * (time-compressed for the pitch). Production ELD writers replace this path.
 */
export async function advanceDemoVehiclePositions(shipments: AdvanceInput[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "auth" };

  const now = Date.now();
  const rows = [];
  for (const s of shipments) {
    const fleet = fleetSpecForLoad(s.load_number);
    if (!fleet) continue;
    const path = pathForShipment(s);
    if (!path || path.length < 2) continue;
    const { point, heading } = computeDemoPosition({
      path,
      speedMph: fleet.speed_mph,
      phaseHours: fleet.phase_hours,
      nowMs: now,
    });
    rows.push({
      shipment_id: s.id,
      lat: Number(point.lat.toFixed(5)),
      lng: Number(point.lng.toFixed(5)),
      speed_mph: fleet.speed_mph,
      heading_deg: Number(heading.toFixed(1)),
      source: "demo_seed",
      recorded_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
  }

  if (rows.length === 0) return { ok: false as const, reason: "empty", count: 0 };

  const { error } = await supabase.from("vehicle_positions").upsert(rows, {
    onConflict: "shipment_id",
  });

  if (error) return { ok: false as const, reason: error.message, count: rows.length };
  return { ok: true as const, count: rows.length };
}
