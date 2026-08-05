"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  coordKey,
  lookupCoords,
  offsetMidpoint,
  type LatLng,
} from "@/lib/geo";

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
  promised_delivery_date: string | null;
  customer_name: string;
  carrier_name: string;
  health_score: number | null;
  health_category: string | null;
};

type PlottedLane = {
  s: MapShipment;
  origin: LatLng;
  dest: LatLng;
  delayed: boolean;
  arc: LatLng;
  mid: LatLng | null;
  color: string;
  weight: number;
  opacity: number;
  zRank: number;
};

type CityHub = {
  key: string;
  point: LatLng;
  kind: "pickup" | "delivery";
  loads: { s: MapShipment; delayed: boolean }[];
  color: string;
};

const QUICK: { id: string; label: string; status: string }[] = [
  { id: "active", label: "Active", status: "active" },
  { id: "exceptions", label: "Exceptions", status: "delayed" },
  { id: "all", label: "All", status: "all" },
];

function isDelayed(s: MapShipment, today: string) {
  return (
    Boolean(s.promised_delivery_date) &&
    (s.promised_delivery_date as string) < today &&
    !["delivered", "completed", "cancelled"].includes(s.status)
  );
}

function statusColor(status: string, delayed: boolean) {
  if (delayed) return "#ef4444";
  if (status === "in_transit" || status === "picked_up") return "#0284c7";
  if (status === "delivered" || status === "completed") return "#22c55e";
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

function FitBounds({ points }: { points: LatLng[] }) {
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
  }, [map, points]);
  return null;
}

export function ShipmentMap({
  shipments,
  today,
}: {
  shipments: MapShipment[];
  today: string;
}) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const customers = useMemo(
    () => [...new Set(shipments.map((s) => s.customer_name))].sort(),
    [shipments],
  );
  const carriers = useMemo(
    () => [...new Set(shipments.map((s) => s.carrier_name))].sort(),
    [shipments],
  );

  const filtered = shipments.filter((s) => {
    if (statusFilter === "delayed") {
      if (!isDelayed(s, today)) return false;
    } else if (statusFilter === "active") {
      if (["delivered", "completed", "cancelled"].includes(s.status)) return false;
    } else if (statusFilter !== "all" && s.status !== statusFilter) {
      return false;
    }
    if (customerFilter !== "all" && s.customer_name !== customerFilter) return false;
    if (carrierFilter !== "all" && s.carrier_name !== carrierFilter) return false;
    if (fromDate && s.promised_delivery_date && s.promised_delivery_date < fromDate) return false;
    if (toDate && s.promised_delivery_date && s.promised_delivery_date > toDate) return false;
    return true;
  });

  const plotted: PlottedLane[] = useMemo(() => {
    const lanes = filtered
      .map((s, index) => {
        const origin = lookupCoords(s.origin_city, s.origin_state, s.pickup_location);
        const dest = lookupCoords(s.dest_city, s.dest_state, s.delivery_location);
        if (!origin || !dest) return null;
        const delayed = isDelayed(s, today);
        const style = laneStyle(s.status, delayed);
        // Alternate side / magnitude so parallel OD pairs separate slightly
        const offset = ((index % 5) - 2) * 0.35;
        const arc = offsetMidpoint(origin, dest, offset);
        const mid =
          s.status === "in_transit" || s.status === "picked_up"
            ? offsetMidpoint(origin, dest, offset * 0.5)
            : null;
        return {
          s,
          origin,
          dest,
          delayed,
          arc,
          mid,
          color: statusColor(s.status, delayed),
          weight: style.weight,
          opacity: style.opacity,
          zRank: style.zRank,
        };
      })
      .filter(Boolean) as PlottedLane[];

    return lanes.sort((a, b) => a.zRank - b.zRank);
  }, [filtered, today]);

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
    () => plotted.flatMap((p) => (p.mid ? [p.origin, p.dest, p.arc, p.mid] : [p.origin, p.dest, p.arc])),
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

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div>
          <h3 className="card-title text-base">Shipment network map</h3>
          <p className="text-sm opacity-70">
            Active lanes by default · city hubs show load counts. OpenStreetMap tiles.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`btn btn-xs ${quickActive === q.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setStatusFilter(q.status)}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
            <option value="delayed">Delayed / exceptions</option>
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

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#eab308]" /> Scheduled /
            assigned
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0284c7]" /> In transit
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Delayed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" /> Delivered
          </span>
        </div>

        <div className="h-[420px] overflow-hidden rounded-box border border-base-300">
          {plotted.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm opacity-70">
              No shipments match these filters (or cities lack demo coordinates).
            </div>
          ) : (
            <MapContainer
              center={[39.5, -98]}
              zoom={4}
              className="h-full w-full"
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={allPoints} />
              {plotted.map((lane) => (
                <Polyline
                  key={`lane-${lane.s.id}`}
                  positions={[
                    [lane.origin.lat, lane.origin.lng],
                    [lane.arc.lat, lane.arc.lng],
                    [lane.dest.lat, lane.dest.lng],
                  ]}
                  pathOptions={{
                    color: lane.color,
                    weight: lane.weight,
                    opacity: lane.opacity,
                  }}
                />
              ))}
              {plotted.map((lane) =>
                lane.mid ? (
                  <CircleMarker
                    key={`mid-${lane.s.id}`}
                    center={[lane.mid.lat, lane.mid.lng]}
                    radius={7}
                    pathOptions={{
                      color: lane.color,
                      fillColor: lane.color,
                      fillOpacity: 0.95,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <ShipmentPopup s={lane.s} delayed={lane.delayed} point="In transit (approx.)" />
                    </Popup>
                  </CircleMarker>
                ) : null,
              )}
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
                  <Popup>
                    <HubPopup hub={hub} />
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>
        <p className="text-xs opacity-60">
          Showing {plotted.length} lane{plotted.length === 1 ? "" : "s"} · {hubs.length} city hub
          {hubs.length === 1 ? "" : "s"}
          {statusFilter === "active" ? " · delivered hidden until All" : ""}. Hollow hubs = pickup;
          filled = delivery.
        </p>
      </div>
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
              · {s.status}
              {delayed ? " (delayed)" : ""} · {s.customer_name}
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
}: {
  s: MapShipment;
  delayed: boolean;
  point: string;
}) {
  return (
    <div className="min-w-[12rem] text-sm">
      <p className="font-semibold">{s.load_number}</p>
      <p className="text-xs opacity-70">{point}</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        <li>Customer: {s.customer_name}</li>
        <li>Carrier: {s.carrier_name}</li>
        <li>
          {s.origin_city}, {s.origin_state} → {s.dest_city}, {s.dest_state}
        </li>
        <li>
          Status: {s.status}
          {delayed ? " (delayed)" : ""}
        </li>
        <li>Expected: {s.promised_delivery_date ?? "—"}</li>
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
