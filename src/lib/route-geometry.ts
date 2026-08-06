/** Cached OSRM/demo road polylines between known hub cities. */

import type { LatLng } from "@/lib/geo";
import { offsetMidpoint, placeKeyFromCoords, resolvePlaceKey } from "@/lib/geo";
import demoPolylines from "@/data/demo-route-polylines.json";

type PolylineCache = Record<string, LatLng[]>;

const CACHE = demoPolylines as PolylineCache;

function routeKey(originCity: string, destCity: string): string {
  return `${originCity}|${destCity}`;
}

/** Arc fallback when a city pair is missing from the OSRM cache. */
function arcFallback(origin: LatLng, dest: LatLng, laneIndex = 0): LatLng[] {
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

/** Deterministic 0→1 phase offset so trucks are not all synced. */
export function simPhaseOffset(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * Ping-pong progress 0→1→0 along a shared polyline (origin → dest → origin).
 * One-way trip defaults to 60s; round trip is 2×. Uses wall clock so clients stay aligned.
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
