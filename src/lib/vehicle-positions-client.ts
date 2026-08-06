"use client";

import { createClient } from "@/lib/supabase/client";
import type { VehiclePositionRow } from "@/lib/vehicle-positions";

export async function fetchVehiclePositions(
  shipmentIds: string[],
): Promise<Map<string, VehiclePositionRow>> {
  const out = new Map<string, VehiclePositionRow>();
  if (shipmentIds.length === 0) return out;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicle_positions")
      .select("shipment_id, lat, lng, speed_mph, heading_deg, source, recorded_at")
      .in("shipment_id", shipmentIds);
    if (error || !data) return out;
    for (const row of data) {
      out.set(row.shipment_id as string, {
        shipment_id: row.shipment_id as string,
        lat: Number(row.lat),
        lng: Number(row.lng),
        speed_mph: Number(row.speed_mph),
        heading_deg: row.heading_deg == null ? null : Number(row.heading_deg),
        source: String(row.source ?? "demo_seed"),
        recorded_at: String(row.recorded_at),
      });
    }
  } catch {
    // Table may not exist yet — caller uses computed demo GPS.
  }
  return out;
}

export async function upsertVehiclePositionsClient(
  rows: {
    shipment_id: string;
    lat: number;
    lng: number;
    speed_mph: number;
    heading_deg: number | null;
    source: string;
  }[],
): Promise<boolean> {
  if (rows.length === 0) return false;
  try {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("vehicle_positions").upsert(
      rows.map((r) => ({
        ...r,
        recorded_at: now,
        updated_at: now,
      })),
      { onConflict: "shipment_id" },
    );
    return !error;
  } catch {
    return false;
  }
}
