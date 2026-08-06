/** Cached OSRM/demo road polylines between known hub cities. */

import type { LatLng } from "@/lib/geo";
import {
  haversineMiles,
  offsetMidpoint,
  placeKeyFromCoords,
  resolvePlaceKey,
} from "@/lib/geo";
import demoPolylines from "@/data/demo-route-polylines.json";

type PolylineCache = Record<string, LatLng[]>;

const CACHE = demoPolylines as PolylineCache;

/** Miles beyond which a ping is considered off the driving path. */
export const OFF_ROUTE_MILES = 5;

export function routeKey(originCity: string, destCity: string): string {
  return `${originCity}|${destCity}`;
}

/** Arc fallback when a city pair is missing from the OSRM cache. */
export function arcFallback(origin: LatLng, dest: LatLng, laneIndex = 0): LatLng[] {
  // Avoid zero offset (perfectly straight chord) — always bow the arc a bit.
  const slot = laneIndex % 5;
  const offset = ((slot - 2) * 0.35) || 0.28;
  return [origin, offsetMidpoint(origin, dest, offset), dest];
}

/**
 * Resolve a road-shaped path between two hubs.
 * Uses the same place-key resolution as `lookupCoords` (location free-text + city/state),
 * then falls back to reverse-matching the resolved LatLng hubs.
 */
export function lookupRoutePath(
  origin: LatLng,
  dest: LatLng,
  originCity?: string | null,
  originState?: string | null,
  destCity?: string | null,
  destState?: string | null,
  laneIndex = 0,
  originLocation?: string | null,
  destLocation?: string | null,
): LatLng[] {
  const oKey =
    resolvePlaceKey(originCity, originState, originLocation) ?? placeKeyFromCoords(origin);
  const dKey =
    resolvePlaceKey(destCity, destState, destLocation) ?? placeKeyFromCoords(dest);
  if (oKey && dKey) {
    const cached = CACHE[routeKey(oKey, dKey)];
    if (cached?.length >= 2) return cached;
  }
  return arcFallback(origin, dest, laneIndex);
}

/** True when the static cache already has a road polyline for this place pair. */
export function hasCachedRoutePath(
  originCity?: string | null,
  originState?: string | null,
  destCity?: string | null,
  destState?: string | null,
  originLocation?: string | null,
  destLocation?: string | null,
  origin?: LatLng | null,
  dest?: LatLng | null,
): boolean {
  const oKey =
    resolvePlaceKey(originCity, originState, originLocation) ??
    (origin ? placeKeyFromCoords(origin) : null);
  const dKey =
    resolvePlaceKey(destCity, destState, destLocation) ??
    (dest ? placeKeyFromCoords(dest) : null);
  if (!oKey || !dKey) return false;
  const cached = CACHE[routeKey(oKey, dKey)];
  return Boolean(cached && cached.length >= 2);
}

/** Cumulative segment lengths (degrees) along a polyline. */
function pathLengths(path: LatLng[]): { total: number; cum: number[] } {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    total += Math.hypot(b.lat - a.lat, b.lng - a.lng);
    cum.push(total);
  }
  return { total, cum };
}

/**
 * Point at fraction `t` (0→1) along a polyline, by chord length in lat/lng degrees.
 */
export function interpolateAlongPath(path: LatLng[], t: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1) return path[0];
  const clamped = Math.min(1, Math.max(0, t));
  const { total, cum } = pathLengths(path);
  if (total <= 0) return path[0];
  const target = clamped * total;
  for (let i = 1; i < path.length; i++) {
    if (cum[i] >= target) {
      const segLen = cum[i] - cum[i - 1];
      const local = segLen > 0 ? (target - cum[i - 1]) / segLen : 0;
      const a = path[i - 1];
      const b = path[i];
      return {
        lat: a.lat + (b.lat - a.lat) * local,
        lng: a.lng + (b.lng - a.lng) * local,
      };
    }
  }
  return path[path.length - 1];
}

/**
 * Deterministic 0→1 phase offset so trucks are not all synced.
 */
export function simPhaseOffset(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * Deterministic route completion 0→1 for a load seed, spread across ~12–88%.
 * When `peerSeeds` is provided (all active tracked load ids/numbers), progress
 * is spaced evenly by sorted order so trucks do not stack.
 */
export function variedRouteProgress(seed: string, peerSeeds?: string[]): number {
  if (peerSeeds && peerSeeds.length > 1) {
    const sorted = [...new Set(peerSeeds)].sort();
    const idx = sorted.indexOf(seed);
    if (idx >= 0) {
      return 0.12 + (idx / (sorted.length - 1)) * 0.76;
    }
  }
  const bands = 13;
  const band = Math.floor(simPhaseOffset(seed) * bands) % bands;
  return 0.12 + (band / (bands - 1)) * 0.76;
}

/** Heading (degrees clockwise from north) of the path tangent at progress t. */
export function headingAlongPath(path: LatLng[], t: number): number {
  if (path.length < 2) return 0;
  const clamped = Math.min(0.999, Math.max(0, t));
  const a = interpolateAlongPath(path, clamped);
  const b = interpolateAlongPath(path, Math.min(1, clamped + 0.002));
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const deg = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Nearest point on a polyline to `point`, with progress 0→1 and distance in miles.
 */
export function nearestOnPath(
  path: LatLng[],
  point: LatLng,
): { progress: number; point: LatLng; distanceMiles: number } {
  if (path.length === 0) {
    return { progress: 0, point: { lat: 0, lng: 0 }, distanceMiles: Infinity };
  }
  if (path.length === 1) {
    return {
      progress: 0,
      point: path[0],
      distanceMiles: haversineMiles(path[0], point),
    };
  }

  const { total, cum } = pathLengths(path);
  if (total <= 0) {
    return {
      progress: 0,
      point: path[0],
      distanceMiles: haversineMiles(path[0], point),
    };
  }

  let bestDist = Infinity;
  let bestPoint = path[0];
  let bestAlong = 0;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const abLat = b.lat - a.lat;
    const abLng = b.lng - a.lng;
    const abLen2 = abLat * abLat + abLng * abLng;
    let local = 0;
    if (abLen2 > 0) {
      local = ((point.lat - a.lat) * abLat + (point.lng - a.lng) * abLng) / abLen2;
      local = Math.min(1, Math.max(0, local));
    }
    const proj = {
      lat: a.lat + abLat * local,
      lng: a.lng + abLng * local,
    };
    const dist = haversineMiles(proj, point);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = proj;
      bestAlong = cum[i - 1] + local * (cum[i] - cum[i - 1]);
    }
  }

  return {
    progress: bestAlong / total,
    point: bestPoint,
    distanceMiles: bestDist,
  };
}

/**
 * Place one truck on a driving path.
 * Durable against seed churn: uses live path + optional GPS ping.
 * - On-route GPS → snap to nearest path point (authoritative road geometry).
 * - Off-route / missing GPS → varied completion % so trucks stay spread out.
 * Reseeding sample data must not remove this behavior (code-owned, not seed-owned).
 */
export function resolveTruckOnRoute(
  path: LatLng[],
  seed: string,
  peerSeeds?: string[],
  lastPosition?: LatLng | null,
): {
  point: LatLng;
  progress: number;
  placement: "gps_on_route" | "gps_snapped" | "varied";
} {
  const fallbackProgress = variedRouteProgress(seed, peerSeeds);
  const fallbackPoint = interpolateAlongPath(path, fallbackProgress);

  if (!lastPosition || path.length < 2) {
    return { point: fallbackPoint, progress: fallbackProgress, placement: "varied" };
  }

  const nearest = nearestOnPath(path, lastPosition);
  if (nearest.distanceMiles <= OFF_ROUTE_MILES) {
    return {
      point: nearest.point,
      progress: nearest.progress,
      placement: "gps_on_route",
    };
  }

  // Off-route ping: keep truck on the real lane at the varied completion %.
  return {
    point: fallbackPoint,
    progress: fallbackProgress,
    placement: "gps_snapped",
  };
}

/**
 * Progress 0→1 from pickup → promised delivery.
 * Delayed (past promise) clamps near the end (~0.92–0.98).
 */
export function simulatedProgress(
  pickupDate: string | null | undefined,
  promisedDeliveryDate: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!pickupDate || !promisedDeliveryDate) return 0.35;
  const start = new Date(pickupDate + "T08:00:00Z").getTime();
  const end = new Date(promisedDeliveryDate + "T17:00:00Z").getTime();
  if (!(end > start)) return 0.5;
  const raw = (nowMs - start) / (end - start);
  if (raw < 0) return 0.05;
  if (raw >= 1) {
    // Past promise: sit near destination with slight hash so markers don't stack perfectly
    const lateDays = (nowMs - end) / (1000 * 60 * 60 * 24);
    return Math.min(0.98, 0.9 + Math.min(lateDays, 8) * 0.01);
  }
  return Math.min(0.95, Math.max(0.05, raw));
}

/**
 * Ping-pong progress 0→1→0 along a shared polyline (origin → dest → origin).
 * Kept for legacy callers; map trucks use {@link variedRouteProgress} instead.
 */
export function pingPongProgress(
  nowMs: number = Date.now(),
  phaseOffset = 0,
  oneWayMs = 60_000,
): number {
  const period = oneWayMs * 2;
  const shifted = ((nowMs % period) + phaseOffset * period + period) % period;
  const t = shifted / period; // 0→1 over a full round trip
  return t <= 0.5 ? t * 2 : 2 - t * 2;
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/** Fetch a driving polyline from public OSRM (server-side / scripts only). */
export async function fetchOsrmDrivingPath(
  origin: LatLng,
  dest: LatLng,
): Promise<LatLng[] | null> {
  const url =
    `${OSRM_BASE}/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
  };
  if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
    return null;
  }
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

/** In-memory memo for OSRM responses within a server process. */
const runtimeMemo = new Map<string, LatLng[]>();

function coordPairKey(origin: LatLng, dest: LatLng): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
}

/**
 * Cache-first driving path: static JSON → runtime memo → OSRM → arc fallback.
 */
export async function resolveDrivingPath(
  origin: LatLng,
  dest: LatLng,
  opts?: {
    originCity?: string | null;
    originState?: string | null;
    destCity?: string | null;
    destState?: string | null;
    originLocation?: string | null;
    destLocation?: string | null;
    laneIndex?: number;
    fetchRemote?: boolean;
  },
): Promise<LatLng[]> {
  const laneIndex = opts?.laneIndex ?? 0;
  const sync = lookupRoutePath(
    origin,
    dest,
    opts?.originCity,
    opts?.originState,
    opts?.destCity,
    opts?.destState,
    laneIndex,
    opts?.originLocation,
    opts?.destLocation,
  );
  // Cached road geometry (more than arcFallback's 3 points) wins immediately.
  if (sync.length > 3) return sync;

  const oKey =
    resolvePlaceKey(opts?.originCity, opts?.originState, opts?.originLocation) ??
    placeKeyFromCoords(origin);
  const dKey =
    resolvePlaceKey(opts?.destCity, opts?.destState, opts?.destLocation) ??
    placeKeyFromCoords(dest);
  if (oKey && dKey) {
    const cached = CACHE[routeKey(oKey, dKey)];
    if (cached?.length >= 2) return cached;
  }

  const memoKey = coordPairKey(origin, dest);
  const memoized = runtimeMemo.get(memoKey);
  if (memoized) return memoized;

  if (opts?.fetchRemote !== false) {
    const remote = await fetchOsrmDrivingPath(origin, dest);
    if (remote && remote.length >= 2) {
      runtimeMemo.set(memoKey, remote);
      return remote;
    }
  }

  return sync.length >= 2 ? sync : arcFallback(origin, dest, laneIndex);
}
