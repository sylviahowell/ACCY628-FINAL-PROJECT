import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/actions/auth";
import { lookupCoords, type LatLng } from "@/lib/geo";
import { isOperations } from "@/lib/types";
import { resolveDrivingPath } from "@/lib/route-geometry";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  origin: z
    .object({ lat: z.number(), lng: z.number() })
    .optional(),
  dest: z
    .object({ lat: z.number(), lng: z.number() })
    .optional(),
  originCity: z.string().nullable().optional(),
  originState: z.string().nullable().optional(),
  destCity: z.string().nullable().optional(),
  destState: z.string().nullable().optional(),
  originLocation: z.string().nullable().optional(),
  destLocation: z.string().nullable().optional(),
  laneIndex: z.number().int().nonnegative().optional(),
});

/**
 * Cache-first driving polyline for a freight lane (origin → dest).
 * Used when the static demo polyline cache misses a city pair.
 * Staff-only so public OSRM is not an open proxy.
 */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isOperations(profile.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const b = parsed.data;
  const origin: LatLng | null =
    b.origin ??
    lookupCoords(b.originCity, b.originState, b.originLocation);
  const dest: LatLng | null =
    b.dest ?? lookupCoords(b.destCity, b.destState, b.destLocation);

  if (!origin || !dest) {
    return NextResponse.json({ error: "unresolved_endpoints" }, { status: 422 });
  }

  const path = await resolveDrivingPath(origin, dest, {
    originCity: b.originCity,
    originState: b.originState,
    destCity: b.destCity,
    destState: b.destState,
    originLocation: b.originLocation,
    destLocation: b.destLocation,
    laneIndex: b.laneIndex ?? 0,
    fetchRemote: true,
  });

  return NextResponse.json({
    path,
    origin,
    dest,
    pointCount: path.length,
  });
}
