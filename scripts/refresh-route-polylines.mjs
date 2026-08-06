/**
 * Refresh demo-route-polylines.json for active freight lanes via public OSRM,
 * and print snapped vehicle_positions upserts for on-route truck placement.
 *
 * IMPORTANT: This file UPDATES the polyline cache used by the network map.
 * Do not delete demo-route-polylines.json when reseeding story data.
 * Map trucks come from live shipments; GPS seed is optional.
 *
 * Usage: node scripts/refresh-route-polylines.mjs
 *        node scripts/refresh-route-polylines.mjs --force   # refetch cached lanes too
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cachePath = join(root, "src/data/demo-route-polylines.json");

const CITY_COORDS = {
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
  "des moines, ia": { lat: 41.5868, lng: -93.625 },
  "minneapolis, mn": { lat: 44.9778, lng: -93.265 },
  "indianapolis, in": { lat: 39.7684, lng: -86.1581 },
  "louisville, ky": { lat: 38.2527, lng: -85.7585 },
  "detroit, mi": { lat: 42.3314, lng: -83.0458 },
  "cleveland, oh": { lat: 41.4993, lng: -81.6944 },
  "milwaukee, wi": { lat: 43.0389, lng: -87.9065 },
  "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
  "new york, ny": { lat: 40.7128, lng: -74.006 },
  "jacksonville, fl": { lat: 30.3322, lng: -81.6557 },
  "charlotte, nc": { lat: 35.2271, lng: -80.8431 },
};

/** Active demo lanes (pickup → delivery place keys). */
const ACTIVE_LANES = [
  ["chicago, il", "atlanta, ga"],
  ["st louis, mo", "kansas city, mo"],
  ["columbus, oh", "nashville, tn"],
  ["houston, tx", "memphis, tn"],
  ["portland, or", "phoenix, az"],
  ["des moines, ia", "minneapolis, mn"],
  ["des moines, ia", "kansas city, mo"],
  ["houston, tx", "dallas, tx"],
  ["omaha, ne", "kansas city, mo"],
  ["denver, co", "phoenix, az"],
  ["dallas, tx", "houston, tx"],
  ["memphis, tn", "atlanta, ga"],
];

/** Tracked loads for vehicle_positions snap (id, load_number, originKey, destKey, speed). */
const TRACKED = [
  {
    id: "44444444-4444-4444-4444-444444444403",
    load: "LD-1003",
    origin: "chicago, il",
    dest: "atlanta, ga",
    speed: 62,
  },
  {
    id: "44444444-4444-4444-4444-444444444410",
    load: "LD-2010-LATE",
    origin: "columbus, oh",
    dest: "nashville, tn",
    speed: 58,
  },
  {
    id: "44444444-4444-4444-4444-444444444404",
    load: "LD-1004",
    origin: "st louis, mo",
    dest: "kansas city, mo",
    speed: 55,
  },
  {
    id: "44444444-4444-4444-4444-444444444422",
    load: "LD-2022-DISP",
    origin: "portland, or",
    dest: "phoenix, az",
    speed: 61,
  },
  {
    id: "44444444-4444-4444-4444-444444444430",
    load: "LD-GPS-01",
    origin: "houston, tx",
    dest: "dallas, tx",
    speed: 64,
  },
  {
    id: "44444444-4444-4444-4444-444444444431",
    load: "LD-GPS-02",
    origin: "omaha, ne",
    dest: "kansas city, mo",
    speed: 60,
  },
  {
    id: "44444444-4444-4444-4444-444444444432",
    load: "LD-GPS-03",
    origin: "denver, co",
    dest: "phoenix, az",
    speed: 55,
  },
  {
    id: "44444444-4444-4444-4444-444444444433",
    load: "LD-GPS-04",
    origin: "dallas, tx",
    dest: "houston, tx",
    speed: 59,
  },
];

function routeKey(a, b) {
  return `${a}|${b}`;
}

function simPhaseOffset(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function variedRouteProgress(seed, peerSeeds) {
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

/** Keep newly fetched OSRM geometries compact for the static JSON cache. */
function downsample(path, maxPts = 80) {
  if (path.length <= maxPts) return path;
  const out = [path[0]];
  const step = (path.length - 1) / (maxPts - 1);
  for (let i = 1; i < maxPts - 1; i++) out.push(path[Math.round(i * step)]);
  out.push(path[path.length - 1]);
  return out;
}

function pathLengths(path) {
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

function interpolateAlongPath(path, t) {
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

function headingAlongPath(path, t) {
  if (path.length < 2) return 0;
  const clamped = Math.min(0.999, Math.max(0, t));
  const a = interpolateAlongPath(path, clamped);
  const b = interpolateAlongPath(path, Math.min(1, clamped + 0.002));
  const deg = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
  return (deg + 360) % 360;
}

async function fetchOsrm(origin, dest) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OSRM ${res.status} for ${url}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
    throw new Error(`OSRM no route: ${data.code}`);
  }
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cache = JSON.parse(readFileSync(cachePath, "utf8"));
  let fetched = 0;

  for (const [o, d] of ACTIVE_LANES) {
    const key = routeKey(o, d);
    const origin = CITY_COORDS[o];
    const dest = CITY_COORDS[d];
    if (!origin || !dest) {
      console.warn("skip unknown cities", key);
      continue;
    }
    const force = process.argv.includes("--force");
    if (!force && cache[key]?.length >= 2) {
      console.log("cached", key, cache[key].length);
      continue;
    }
    console.log("fetching", key);
    try {
      cache[key] = downsample(await fetchOsrm(origin, dest), 80);
      fetched += 1;
      console.log("  ->", cache[key].length, "points");
      await sleep(1100);
    } catch (err) {
      console.error("  failed", err.message);
    }
  }

  writeFileSync(cachePath, JSON.stringify(cache));
  console.log(`Wrote ${cachePath} (fetched ${fetched} new lanes)`);

  console.log("\n-- snapped vehicle_positions");
  const peerSeeds = TRACKED.map((t) => t.load);
  for (const t of TRACKED) {
    const key = routeKey(t.origin, t.dest);
    const path = cache[key];
    if (!path?.length) {
      console.warn("no path for", t.load, key);
      continue;
    }
    const progress = variedRouteProgress(t.load, peerSeeds);
    const pos = interpolateAlongPath(path, progress);
    const heading = headingAlongPath(path, progress);
    console.log(
      `-- ${t.load} ${(progress * 100).toFixed(1)}% ${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`,
    );
    console.log(
      `INSERT INTO public.vehicle_positions (shipment_id, lat, lng, speed_mph, heading_deg, source, recorded_at, updated_at)
VALUES ('${t.id}', ${pos.lat}, ${pos.lng}, ${t.speed}, ${heading.toFixed(2)}, 'demo_snapped', now(), now())
ON CONFLICT (shipment_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  speed_mph = EXCLUDED.speed_mph,
  heading_deg = EXCLUDED.heading_deg,
  source = EXCLUDED.source,
  recorded_at = EXCLUDED.recorded_at,
  updated_at = EXCLUDED.updated_at;`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
