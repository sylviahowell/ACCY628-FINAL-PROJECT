/** Demo city coordinates for map markers (not live GPS). */

export type LatLng = { lat: number; lng: number };

const CITY_COORDS: Record<string, LatLng> = {
  "chicago, il": { lat: 41.8781, lng: -87.6298 },
  "dallas, tx": { lat: 32.7767, lng: -96.797 },
  "atlanta, ga": { lat: 33.749, lng: -84.388 },
  "houston, tx": { lat: 29.7604, lng: -95.3698 },
  "denver, co": { lat: 39.7392, lng: -104.9903 },
  "columbus, oh": { lat: 39.9612, lng: -82.9988 },
  "nashville, tn": { lat: 36.1627, lng: -86.7816 },
  "memphis, tn": { lat: 35.1495, lng: -90.049 },
  "portland, or": { lat: 45.5152, lng: -122.6784 },
  "phoenix, az": { lat: 33.4484, lng: -112.074 },
  "omaha, ne": { lat: 41.2565, lng: -95.9345 },
  "kansas city, mo": { lat: 39.0997, lng: -94.5786 },
  "st louis, mo": { lat: 38.627, lng: -90.1994 },
  "st. louis, mo": { lat: 38.627, lng: -90.1994 },
  "des moines, ia": { lat: 41.5868, lng: -93.625 },
  "indianapolis, in": { lat: 39.7684, lng: -86.1581 },
  "louisville, ky": { lat: 38.2527, lng: -85.7585 },
  "detroit, mi": { lat: 42.3314, lng: -83.0458 },
  "cleveland, oh": { lat: 41.4993, lng: -81.6944 },
  "minneapolis, mn": { lat: 44.9778, lng: -93.265 },
  "milwaukee, wi": { lat: 43.0389, lng: -87.9065 },
  "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
  "new york, ny": { lat: 40.7128, lng: -74.006 },
  "jacksonville, fl": { lat: 30.3322, lng: -81.6557 },
  "charlotte, nc": { lat: 35.2271, lng: -80.8431 },
};

/** Earth mean radius in statute miles. */
const EARTH_RADIUS_MI = 3958.8;

/** Highway distance is typically longer than straight-line; demo factor for quotes. */
const ROAD_DISTANCE_FACTOR = 1.18;

function scrub(s: string) {
  return s.trim().toLowerCase().replace(/\./g, "");
}

/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimate road miles between two place strings (e.g. "Chicago, IL").
 * Uses the demo city table — returns null when either place is unknown.
 */
export function estimateLaneMiles(
  pickupLocation?: string | null,
  deliveryLocation?: string | null,
): number | null {
  const origin = lookupCoords(null, null, pickupLocation);
  const dest = lookupCoords(null, null, deliveryLocation);
  if (!origin || !dest) return null;
  if (origin.lat === dest.lat && origin.lng === dest.lng) return 0;
  return Math.max(1, Math.round(haversineMiles(origin, dest) * ROAD_DISTANCE_FACTOR));
}

/** Candidate place strings: location free-text first, then city/state. */
function placeCandidates(
  city?: string | null,
  state?: string | null,
  location?: string | null,
): string[] {
  const out: string[] = [];
  if (location?.trim()) out.push(scrub(location));
  if (city?.trim()) {
    out.push(scrub(`${city}${state ? `, ${state}` : ""}`));
  }
  return out;
}

/** Match a scrubbed place string to a canonical CITY_COORDS key. */
function matchCityKey(raw: string): string | null {
  if (!raw) return null;
  if (CITY_COORDS[raw]) {
    // Prefer dotted-stripped canonical form used by route cache
    return raw.replace(/\./g, "");
  }
  const cityOnly = raw.split(",")[0]?.trim();
  if (!cityOnly) return null;
  for (const k of Object.keys(CITY_COORDS)) {
    if (k.startsWith(cityOnly + ",")) return k.replace(/\./g, "");
  }
  return null;
}

/**
 * Canonical hub key (`city, st`) shared by coords + demo route cache.
 * Tries pickup/delivery free text, then structured city/state.
 */
export function resolvePlaceKey(
  city?: string | null,
  state?: string | null,
  location?: string | null,
): string | null {
  for (const candidate of placeCandidates(city, state, location)) {
    const key = matchCityKey(candidate);
    if (key) return key;
  }
  return null;
}

/** Reverse-lookup canonical hub key from resolved demo coordinates. */
export function placeKeyFromCoords(point: LatLng): string | null {
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (Math.abs(v.lat - point.lat) < 0.001 && Math.abs(v.lng - point.lng) < 0.001) {
      return k.replace(/\./g, "");
    }
  }
  return null;
}

export function lookupCoords(
  city?: string | null,
  state?: string | null,
  location?: string | null,
): LatLng | null {
  const key = resolvePlaceKey(city, state, location);
  if (!key) return null;
  return CITY_COORDS[key] ?? null;
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/** Midpoint offset perpendicular to the chord (degrees) for arced lanes. */
export function offsetMidpoint(a: LatLng, b: LatLng, offset: number): LatLng {
  const mid = midpoint(a, b);
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const len = Math.hypot(dLat, dLng) || 1;
  return {
    lat: mid.lat + (-dLng / len) * offset,
    lng: mid.lng + (dLat / len) * offset,
  };
}

export function coordKey(p: LatLng): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}
