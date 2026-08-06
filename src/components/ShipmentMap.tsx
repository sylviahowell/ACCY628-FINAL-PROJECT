"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { coordKey, lookupCoords, type LatLng } from "@/lib/geo";
import { formatStatusLabel } from "@/lib/types";
import {
  hasCachedRoutePath,
  lookupRoutePath,
  resolveTruckOnRoute,
} from "@/lib/route-geometry";

export type MapVehiclePosition = {
  lat: number;
  lng: number;
  speed_mph: number | null;
  heading_deg: number | null;
  recorded_at: string | null;
  source: string | null;
};

export type MapShipment = {
  id: string;
  load_number: string;
  status: string;
  origin_city: string | null;
  origin_state: string | null;
  dest_city: string | null;
  dest_state: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_date: string | null;
  promised_delivery_date: string | null;
  customer_name: string;
  carrier_name: string;
  health_score: number | null;
  health_category: string | null;
  /** Last reported ping (may be snapped onto the driving path). */
  last_position?: MapVehiclePosition | null;
};

type PlottedLane = {
  s: MapShipment;
  origin: LatLng;
  dest: LatLng;
  path: LatLng[];
  delayed: boolean;
  color: string;
  weight: number;
  opacity: number;
  zRank: number;
  /** True when this load gets one on-route truck marker. */
  truckTracking: boolean;
  /** Route completion 0→1 for the single truck on this lane. */
  routeProgress: number | null;
  /** Resolved on-route marker position (GPS snap or varied %). */
  truckPoint: LatLng | null;
  truckPlacement: "gps_on_route" | "gps_snapped" | "varied" | null;
};

type CityHub = {
  key: string;
  point: LatLng;
  kind: "pickup" | "delivery";
  loads: { s: MapShipment; delayed: boolean }[];
  color: string;
};

const QUICK: { id: string; label: string; status: string }[] = [
  { id: "exceptions", label: "Delayed", status: "delayed" },
  { id: "active", label: "Active", status: "active" },
  { id: "all", label: "All", status: "all" },
];

function isDelayed(s: MapShipment, today: string) {
  return (
    Boolean(s.promised_delivery_date) &&
    (s.promised_delivery_date as string) < today &&
    !["delivered", "completed", "cancelled"].includes(s.status)
  );
}

/** Calendar days past promised delivery (0 if on time / unknown). */
function daysPastPromised(promised: string | null, today: string): number | null {
  if (!promised) return null;
  const ms =
    new Date(today + "T00:00:00Z").getTime() -
    new Date(promised + "T00:00:00Z").getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function laneLabel(s: MapShipment) {
  const from = [s.origin_city, s.origin_state].filter(Boolean).join(", ") || "Origin";
  const to = [s.dest_city, s.dest_state].filter(Boolean).join(", ") || "Destination";
  return `${from} → ${to}`;
}

function statusColor(status: string, delayed: boolean) {
  if (delayed) return "#ef4444";
  if (status === "in_transit" || status === "picked_up") return "#0284c7";
  if (status === "delivered" || status === "completed") return "#22c55e";
  if (status === "offered") return "#f59e0b";
  if (status === "scheduled" || status === "assigned" || status === "booked") return "#eab308";
  return "#94a3b8";
}

function laneStyle(status: string, delayed: boolean) {
  if (delayed) return { weight: 3.5, opacity: 0.9, zRank: 4 };
  if (status === "in_transit" || status === "picked_up") return { weight: 3, opacity: 0.75, zRank: 3 };
  if (status === "delivered" || status === "completed") return { weight: 1.5, opacity: 0.28, zRank: 1 };
  return { weight: 2.25, opacity: 0.6, zRank: 2 };
}

function hubPriorityColor(loads: { s: MapShipment; delayed: boolean }[]) {
  if (loads.some((l) => l.delayed)) return "#ef4444";
  if (loads.some((l) => l.s.status === "in_transit" || l.s.status === "picked_up")) return "#0284c7";
  if (loads.some((l) => ["scheduled", "assigned", "booked"].includes(l.s.status))) return "#eab308";
  if (loads.some((l) => l.s.status === "delivered" || l.s.status === "completed")) return "#22c55e";
  return "#94a3b8";
}

function isSimTracking(status: string) {
  return status === "in_transit" || status === "picked_up";
}

/**
 * Fit once when the plotted lane set meaningfully changes.
 * Uses a stable string key (shipment ids) — NOT array identity.
 */
function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [40, 40] },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- points from the fitKey render
  }, [map, fitKey]);
  return null;
}

  /** Upgrade arc-fallback lanes with OSRM geometry from the route-geometry API. */
function useRemoteRoutePaths(
  lanes: {
    id: string;
    origin: LatLng;
    dest: LatLng;
    needsRemote: boolean;
    originCity: string | null;
    originState: string | null;
    destCity: string | null;
    destState: string | null;
    pickupLocation: string | null;
    deliveryLocation: string | null;
    laneIndex: number;
  }[],
) {
  const [overrides, setOverrides] = useState<Record<string, LatLng[]>>({});
  const [attempted, setAttempted] = useState<Record<string, number>>({});
  const requestKey = lanes
    .filter((l) => l.needsRemote)
    .map((l) => l.id)
    .sort()
    .join("|");

  useEffect(() => {
    const missing = lanes.filter((l) => {
      if (!l.needsRemote || overrides[l.id]) return false;
      const tries = attempted[l.id] ?? 0;
      return tries < 2;
    });
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, LatLng[]> = {};
      const tried: Record<string, number> = {};
      await Promise.all(
        missing.map(async (lane) => {
          tried[lane.id] = (attempted[lane.id] ?? 0) + 1;
          try {
            const res = await fetch("/api/route-geometry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                origin: lane.origin,
                dest: lane.dest,
                originCity: lane.originCity,
                originState: lane.originState,
                destCity: lane.destCity,
                destState: lane.destState,
                originLocation: lane.pickupLocation,
                destLocation: lane.deliveryLocation,
                laneIndex: lane.laneIndex,
              }),
            });
            if (!res.ok) return;
            const data = (await res.json()) as { path?: LatLng[] };
            if (data.path && data.path.length >= 2) next[lane.id] = data.path;
          } catch {
            /* keep sync fallback */
          }
        }),
      );
      if (cancelled) return;
      if (Object.keys(tried).length > 0) {
        setAttempted((prev) => ({ ...prev, ...tried }));
      }
      if (Object.keys(next).length > 0) {
        setOverrides((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey captures lane set
  }, [requestKey]);

  return overrides;
}

export function ShipmentMap({
  shipments,
  today,
}: {
  shipments: MapShipment[];
  today: string;
}) {
  const [statusFilter, setStatusFilter] = useState(() =>
    shipments.some((s) => isDelayed(s, today)) ? "delayed" : "active",
  );
  const [customerFilter, setCustomerFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const customers = useMemo(
    () => [...new Set(shipments.map((s) => s.customer_name))].sort(),
    [shipments],
  );
  const carriers = useMemo(
    () => [...new Set(shipments.map((s) => s.carrier_name))].sort(),
    [shipments],
  );

  const filtered = useMemo(
    () =>
      shipments.filter((s) => {
        if (statusFilter === "delayed") {
          if (!isDelayed(s, today)) return false;
        } else if (statusFilter === "active") {
          if (["delivered", "completed", "cancelled"].includes(s.status)) return false;
        } else if (statusFilter !== "all" && s.status !== statusFilter) {
          return false;
        }
        if (customerFilter !== "all" && s.customer_name !== customerFilter) return false;
        if (carrierFilter !== "all" && s.carrier_name !== carrierFilter) return false;
        if (fromDate && s.promised_delivery_date && s.promised_delivery_date < fromDate) {
          return false;
        }
        if (toDate && s.promised_delivery_date && s.promised_delivery_date > toDate) {
          return false;
        }
        return true;
      }),
    [shipments, today, statusFilter, customerFilter, carrierFilter, fromDate, toDate],
  );

  const baseLanes = useMemo(() => {
    // Space progress across all active tracked loads (not just the filtered view)
    // so trucks keep stable completion % when filters change.
    const trackingSeeds = shipments
      .filter((s) => isSimTracking(s.status))
      .map((s) => s.load_number || s.id);

    return filtered
      .map((s, index) => {
        const origin = lookupCoords(s.origin_city, s.origin_state, s.pickup_location);
        const dest = lookupCoords(s.dest_city, s.dest_state, s.delivery_location);
        if (!origin || !dest) return null;
        const delayed = isDelayed(s, today);
        const style = laneStyle(s.status, delayed);
        const cached = hasCachedRoutePath(
          s.origin_city,
          s.origin_state,
          s.dest_city,
          s.dest_state,
          s.pickup_location,
          s.delivery_location,
          origin,
          dest,
        );
        const path = lookupRoutePath(
          origin,
          dest,
          s.origin_city,
          s.origin_state,
          s.dest_city,
          s.dest_state,
          index,
          s.pickup_location,
          s.delivery_location,
        );
        const truckTracking = isSimTracking(s.status);
        const seed = s.load_number || s.id;
        const placement = truckTracking
          ? resolveTruckOnRoute(
              path,
              seed,
              trackingSeeds,
              s.last_position
                ? { lat: s.last_position.lat, lng: s.last_position.lng }
                : null,
            )
          : null;
        return {
          s,
          origin,
          dest,
          path,
          delayed,
          color: statusColor(s.status, delayed),
          weight: style.weight,
          opacity: style.opacity,
          zRank: style.zRank,
          truckTracking,
          routeProgress: placement?.progress ?? null,
          truckPoint: placement?.point ?? null,
          truckPlacement: placement?.placement ?? null,
          needsRemote: !cached,
          laneIndex: index,
        };
      })
      .filter(Boolean) as (PlottedLane & {
      needsRemote: boolean;
      laneIndex: number;
      truckPoint: LatLng | null;
      truckPlacement: "gps_on_route" | "gps_snapped" | "varied" | null;
    })[];
  }, [filtered, today, shipments]);

  const remotePaths = useRemoteRoutePaths(
    baseLanes.map((lane) => ({
      id: lane.s.id,
      origin: lane.origin,
      dest: lane.dest,
      needsRemote: lane.needsRemote,
      originCity: lane.s.origin_city,
      originState: lane.s.origin_state,
      destCity: lane.s.dest_city,
      destState: lane.s.dest_state,
      pickupLocation: lane.s.pickup_location,
      deliveryLocation: lane.s.delivery_location,
      laneIndex: lane.laneIndex,
    })),
  );

  const plotted = useMemo(() => {
    const trackingSeeds = shipments
      .filter((s) => isSimTracking(s.status))
      .map((s) => s.load_number || s.id);

    const lanes = baseLanes.map((lane) => {
      const path = remotePaths[lane.s.id] ?? lane.path;
      const seed = lane.s.load_number || lane.s.id;
      const placement = lane.truckTracking
        ? resolveTruckOnRoute(
            path,
            seed,
            trackingSeeds,
            lane.s.last_position
              ? { lat: lane.s.last_position.lat, lng: lane.s.last_position.lng }
              : null,
          )
        : null;
      return {
        ...lane,
        path,
        routeProgress: placement?.progress ?? null,
        truckPoint: placement?.point ?? null,
        truckPlacement: placement?.placement ?? null,
      };
    });
    return lanes.sort((a, b) => a.zRank - b.zRank);
  }, [baseLanes, remotePaths, shipments]);

  /** Refit when shipment set or upgraded road geometry arrives. */
  const fitKey = useMemo(
    () =>
      plotted
        .map((p) => `${p.s.id}:${p.path.length}`)
        .sort()
        .join("|"),
    [plotted],
  );

  const hubs: CityHub[] = useMemo(() => {
    const map = new Map<string, CityHub>();

    function add(
      point: LatLng,
      kind: "pickup" | "delivery",
      s: MapShipment,
      delayed: boolean,
    ) {
      const key = `${coordKey(point)}:${kind}`;
      const existing = map.get(key);
      if (existing) {
        existing.loads.push({ s, delayed });
        existing.color = hubPriorityColor(existing.loads);
        return;
      }
      map.set(key, {
        key,
        point,
        kind,
        loads: [{ s, delayed }],
        color: statusColor(s.status, delayed),
      });
    }

    for (const lane of plotted) {
      add(lane.origin, "pickup", lane.s, lane.delayed);
      add(lane.dest, "delivery", lane.s, lane.delayed);
    }

    return [...map.values()];
  }, [plotted]);

  const allPoints = useMemo(
    () => plotted.flatMap((p) => p.path),
    [plotted],
  );

  const quickActive =
    statusFilter === "active"
      ? "active"
      : statusFilter === "delayed"
        ? "exceptions"
        : statusFilter === "all"
          ? "all"
          : null;

  const advancedFilterCount =
    (customerFilter !== "all" ? 1 : 0) +
    (carrierFilter !== "all" ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0) +
    (statusFilter !== "active" && statusFilter !== "delayed" && statusFilter !== "all" ? 1 : 0);

  const delayedLoads = useMemo(
    () =>
      shipments
        .filter((s) => isDelayed(s, today))
        .map((s) => ({
          s,
          daysLate: daysPastPromised(s.promised_delivery_date, today) ?? 0,
        }))
        .sort((a, b) => b.daysLate - a.daysLate),
    [shipments, today],
  );
  const exceptionCount = delayedLoads.length;

  return (
    <div id="shipment-network-map" className="card scroll-mt-24 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Shipment network map</h3>
            <p className="text-sm opacity-70">
              Driving routes from pickup → delivery · one truck per active route (GPS snaps on-route when present)
            </p>
          </div>
          {exceptionCount > 0 ? (
            <span className="badge badge-error badge-outline">
              {exceptionCount} delayed load{exceptionCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="badge badge-success badge-outline">No delayed loads</span>
          )}
        </div>

        {exceptionCount > 0 ? (
          <div className="rounded-box border border-error/25 bg-error/5 px-3 py-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-error">
                Delayed loads (past promised delivery)
              </p>
              {statusFilter !== "delayed" ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => setStatusFilter("delayed")}
                >
                  Show on map
                </button>
              ) : (
                <span className="text-[11px] opacity-60">Showing delayed lanes only</span>
              )}
            </div>
            <ul className="space-y-1.5">
              {delayedLoads.map(({ s, daysLate }) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
                >
                  <span>
                    <Link href={`/shipments/${s.id}`} className="link link-hover font-medium">
                      {s.load_number}
                    </Link>
                    <span className="opacity-70"> · {laneLabel(s)}</span>
                  </span>
                  <span className="text-xs opacity-70">
                    Promised {s.promised_delivery_date} · {daysLate} day
                    {daysLate === 1 ? "" : "s"} late · {formatStatusLabel(s.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`btn btn-sm ${quickActive === q.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setStatusFilter(q.status)}
            >
              {q.label}
              {q.id === "exceptions" && exceptionCount > 0 ? (
                <span className="badge badge-xs badge-error ml-1">{exceptionCount}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className={`btn btn-sm ml-auto ${showFilters || advancedFilterCount > 0 ? "btn-outline" : "btn-ghost"}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters
            {advancedFilterCount > 0 ? (
              <span className="badge badge-xs badge-primary">{advancedFilterCount}</span>
            ) : null}
          </button>
        </div>

        {showFilters ? (
          <div className="grid gap-2 rounded-box border border-base-300 bg-base-200/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              className="select select-bordered select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Active (hide delivered)</option>
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed (past promised delivery)</option>
            </select>
            <select
              className="select select-bordered select-sm"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered select-sm"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            >
              <option value="all">All carriers</option>
              {carriers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From expected delivery"
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To expected delivery"
            />
          </div>
        ) : null}

        <div className="relative h-[420px] overflow-hidden rounded-box border border-base-300">
          {plotted.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm opacity-70">
              {statusFilter === "delayed" ? (
                <>
                  <p>No delayed loads match these filters.</p>
                  <p className="text-xs">
                    Delayed means promised delivery is past and the load is not yet delivered.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => setStatusFilter("active")}
                  >
                    Show active lanes
                  </button>
                </>
              ) : (
                <p>No shipments match these filters (or cities lack demo coordinates).</p>
              )}
            </div>
          ) : (
            <MapContainer
              center={[39.5, -98]}
              zoom={4}
              className="h-full w-full"
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <FitBounds points={allPoints} fitKey={fitKey} />
              {plotted.map((lane) => (
                <Polyline
                  key={`lane-${lane.s.id}`}
                  positions={lane.path.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: lane.color,
                    weight: lane.weight,
                    opacity: lane.opacity,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              ))}
              {plotted.map((lane) => {
                if (!lane.truckTracking || lane.routeProgress == null || !lane.truckPoint) {
                  return null;
                }
                const pos = lane.truckPoint;
                const daysLate = daysPastPromised(lane.s.promised_delivery_date, today);
                const pct = Math.round(lane.routeProgress * 100);
                const pointLabel =
                  lane.truckPlacement === "gps_on_route"
                    ? "Last reported (on route)"
                    : lane.truckPlacement === "gps_snapped"
                      ? "On-route position (GPS snapped to lane)"
                      : "On-route position";
                return (
                  <CircleMarker
                    key={`truck-${lane.s.id}`}
                    center={[pos.lat, pos.lng]}
                    radius={lane.delayed ? 9 : 8}
                    pathOptions={{
                      color: lane.delayed ? "#991b1b" : "#0c4a6e",
                      fillColor: lane.color,
                      fillOpacity: 1,
                      weight: 2.5,
                      className: lane.delayed ? "rl-sim-truck-delayed" : "rl-sim-truck",
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                      <span className="text-xs font-medium">
                        {lane.s.load_number}
                        {lane.s.carrier_name ? ` · ${lane.s.carrier_name}` : ""}
                        {` · ${pct}%`}
                      </span>
                    </Tooltip>
                    <Popup>
                      <ShipmentPopup
                        s={lane.s}
                        delayed={lane.delayed}
                        point={pointLabel}
                        daysLate={daysLate}
                        progressPct={pct}
                      />
                    </Popup>
                  </CircleMarker>
                );
              })}
              {hubs.map((hub) => (
                <CircleMarker
                  key={hub.key}
                  center={[hub.point.lat, hub.point.lng]}
                  radius={hub.loads.length > 1 ? 8 : 6}
                  pathOptions={{
                    color: hub.color,
                    fillColor: hub.kind === "pickup" ? "#fff" : hub.color,
                    fillOpacity: hub.kind === "pickup" ? 1 : 0.9,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                    <HubHoverTooltip hub={hub} />
                  </Tooltip>
                  <Popup>
                    <HubPopup hub={hub} />
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex max-w-[min(100%-1.5rem,28rem)] flex-wrap gap-2 rounded-box border border-base-300/80 bg-base-100/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur-sm">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#eab308]" /> Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#0284c7]" /> In transit
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#0c4a6e] bg-[#0284c7]" />{" "}
              Truck (on route)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#ef4444]" /> Delayed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" /> Delivered
            </span>
            <span className="w-full opacity-60">One truck per active route · varied completion %</span>
          </div>
        </div>
        <p className="text-xs opacity-60">
          Showing {plotted.length} lane{plotted.length === 1 ? "" : "s"} · {hubs.length} city hub
          {hubs.length === 1 ? "" : "s"}
          {statusFilter === "delayed" ? " · delayed loads only" : ""}
          {statusFilter === "active" ? " · delivered hidden" : ""}. Hollow hubs = pickup; filled =
          delivery. Routes follow driving geometry between freight addresses; trucks sit on-route.
        </p>
      </div>
    </div>
  );
}

function HubHoverTooltip({ hub }: { hub: CityHub }) {
  const title = hub.kind === "pickup" ? "Pickup" : "Delivery";
  if (hub.loads.length === 1) {
    const { s } = hub.loads[0];
    return (
      <span className="text-xs font-medium">
        {title}: {s.load_number}
        {s.carrier_name ? ` · ${s.carrier_name}` : ""}
      </span>
    );
  }
  return (
    <div className="max-w-[14rem] text-xs">
      <p className="font-semibold">
        {title} · {hub.loads.length} loads
      </p>
      <ul className="mt-0.5 space-y-0.5">
        {hub.loads.slice(0, 5).map(({ s }) => (
          <li key={s.id}>
            {s.load_number}
            {s.carrier_name ? ` · ${s.carrier_name}` : ""}
          </li>
        ))}
        {hub.loads.length > 5 ? (
          <li className="opacity-70">+{hub.loads.length - 5} more</li>
        ) : null}
      </ul>
    </div>
  );
}

function HubPopup({ hub }: { hub: CityHub }) {
  const title = hub.kind === "pickup" ? "Pickup hub" : "Delivery hub";
  return (
    <div className="min-w-[12rem] max-w-[16rem] text-sm">
      <p className="font-semibold">
        {title} · {hub.loads.length} load{hub.loads.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {hub.loads.map(({ s, delayed }) => (
          <li key={s.id} className="border-t border-base-200 pt-1 first:border-0 first:pt-0">
            <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
              {s.load_number}
            </Link>
            <span className="opacity-70">
              {" "}
              · {formatStatusLabel(s.status)}
              {delayed ? " · delayed" : ""}
              {s.carrier_name ? ` · ${s.carrier_name}` : ""} · {s.customer_name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShipmentPopup({
  s,
  delayed,
  point,
  daysLate,
  progressPct,
}: {
  s: MapShipment;
  delayed: boolean;
  point: string;
  daysLate?: number | null;
  progressPct?: number;
}) {
  const pos = s.last_position;
  return (
    <div className="min-w-[12rem] text-sm">
      <p className="font-semibold">{s.load_number}</p>
      <p className="text-xs opacity-70">{point}</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        <li>Customer: {s.customer_name}</li>
        <li>Carrier: {s.carrier_name}</li>
        <li>
          {s.pickup_location || `${s.origin_city}, ${s.origin_state}`} →{" "}
          {s.delivery_location || `${s.dest_city}, ${s.dest_state}`}
        </li>
        <li>
          Status: {formatStatusLabel(s.status)}
          {delayed ? " · delayed (past promised delivery)" : ""}
        </li>
        {progressPct != null ? <li>Route complete: ~{progressPct}%</li> : null}
        {pos?.speed_mph != null ? <li>Speed: {Number(pos.speed_mph).toFixed(0)} mph</li> : null}
        {pos?.recorded_at ? (
          <li>Reported: {new Date(pos.recorded_at).toLocaleString()}</li>
        ) : null}
        <li>Promised delivery: {s.promised_delivery_date ?? "—"}</li>
        {delayed && daysLate != null && daysLate > 0 ? (
          <li>
            {daysLate} day{daysLate === 1 ? "" : "s"} late
          </li>
        ) : null}
        {s.health_score != null ? (
          <li>
            Health: {s.health_score} — {s.health_category}
          </li>
        ) : null}
      </ul>
      <Link href={`/shipments/${s.id}`} className="link link-primary text-xs">
        Open shipment
      </Link>
    </div>
  );
}
