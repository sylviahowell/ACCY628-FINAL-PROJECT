/** Demo vehicle GPS helpers — production-shaped positions along cached routes. */

import fleetJson from "@/data/demo-vehicle-fleet.json";
import { lookupCoords, type LatLng } from "@/lib/geo";
import {
  DEMO_GPS_TIME_SCALE,
  interpolateAlongPath,
  lookupRoutePath,
  motionAtSpeedMph,
  pathLengthMiles,
} from "@/lib/route-geometry";

export type VehiclePositionRow = {
  shipment_id: string;
  lat: number;
  lng: number;
  speed_mph: number;
  heading_deg: number | null;
  source: string;
  recorded_at: string;
};

type FleetSpec = {
  load_number: string;
  speed_mph: number;
  phase_hours: number;
};

const FLEET = fleetJson as FleetSpec[];
const FLEET_BY_LOAD = new Map(FLEET.map((f) => [f.load_number, f]));

export function fleetSpecForLoad(loadNumber: string): FleetSpec | null {
  return FLEET_BY_LOAD.get(loadNumber) ?? null;
}

export function isDemoGpsLoad(loadNumber: string): boolean {
  return FLEET_BY_LOAD.has(loadNumber);
}

export function headingAlongPath(
  path: LatLng[],
  t: number,
  outbound = true,
): number {
  if (path.length < 2) return 0;
  const clamped = Math.min(0.999, Math.max(0.001, t));
  const delta = outbound ? 0.01 : -0.01;
  const a = interpolateAlongPath(path, clamped);
  const b = interpolateAlongPath(path, Math.min(1, Math.max(0, clamped + delta)));
  const deg = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function computeDemoPosition(args: {
  path: LatLng[];
  speedMph: number;
  phaseHours: number;
  nowMs?: number;
}): {
  point: LatLng;
  /** Path fraction from origin (0→1→0). Use for map position. */
  progress: number;
  /** Current-leg progress 0→1 (never counts down). Use for popup %. */
  legProgress: number;
  outbound: boolean;
  heading: number;
  miles: number;
} {
  const nowMs = args.nowMs ?? Date.now();
  const motion = motionAtSpeedMph(
    args.path,
    args.speedMph,
    nowMs,
    args.phaseHours,
    DEMO_GPS_TIME_SCALE,
  );
  const point = interpolateAlongPath(args.path, motion.pathT);
  return {
    point,
    progress: motion.pathT,
    legProgress: motion.legProgress,
    outbound: motion.outbound,
    heading: headingAlongPath(args.path, motion.pathT, motion.outbound),
    miles: pathLengthMiles(args.path),
  };
}

/** Build route path for a map shipment (shared with ShipmentMap). */
export function pathForShipment(s: {
  origin_city: string | null;
  origin_state: string | null;
  dest_city: string | null;
  dest_state: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
}): LatLng[] | null {
  const origin = lookupCoords(s.origin_city, s.origin_state, s.pickup_location);
  const dest = lookupCoords(s.dest_city, s.dest_state, s.delivery_location);
  if (!origin || !dest) return null;
  return lookupRoutePath(
    origin,
    dest,
    s.origin_city,
    s.origin_state,
    s.dest_city,
    s.dest_state,
    0,
    s.pickup_location,
    s.delivery_location,
  );
}
