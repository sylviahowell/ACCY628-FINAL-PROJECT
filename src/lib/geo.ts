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
};

function normalizePlace(city?: string | null, state?: string | null, location?: string | null) {
  if (location?.trim()) {
    return location.trim().toLowerCase().replace(/\./g, "");
  }
  if (city) {
    return `${city}${state ? `, ${state}` : ""}`.trim().toLowerCase().replace(/\./g, "");
  }
  return "";
}

export function lookupCoords(
  city?: string | null,
  state?: string | null,
  location?: string | null,
): LatLng | null {
  const key = normalizePlace(city, state, location);
  if (!key) return null;
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  // Try city-only match
  const cityOnly = key.split(",")[0]?.trim();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.startsWith(cityOnly + ",")) return v;
  }
  return null;
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
