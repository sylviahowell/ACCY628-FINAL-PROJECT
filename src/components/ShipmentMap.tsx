"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { lookupCoords, midpoint, type LatLng } from "@/lib/geo";

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

function statusColor(status: string, delayed: boolean) {
  if (delayed) return "#ef4444";
  if (status === "in_transit" || status === "picked_up") return "#0284c7";
  if (status === "delivered" || status === "completed") return "#22c55e";
  if (status === "scheduled" || status === "assigned" || status === "booked") return "#eab308";
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
  const [statusFilter, setStatusFilter] = useState("all");
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
      const delayed =
        Boolean(s.promised_delivery_date) &&
        (s.promised_delivery_date as string) < today &&
        !["delivered", "completed", "cancelled"].includes(s.status);
      if (!delayed) return false;
    } else if (statusFilter !== "all" && s.status !== statusFilter) {
      return false;
    }
    if (customerFilter !== "all" && s.customer_name !== customerFilter) return false;
    if (carrierFilter !== "all" && s.carrier_name !== carrierFilter) return false;
    if (fromDate && s.promised_delivery_date && s.promised_delivery_date < fromDate) return false;
    if (toDate && s.promised_delivery_date && s.promised_delivery_date > toDate) return false;
    return true;
  });

  const plotted = filtered
    .map((s) => {
      const origin = lookupCoords(s.origin_city, s.origin_state, s.pickup_location);
      const dest = lookupCoords(s.dest_city, s.dest_state, s.delivery_location);
      if (!origin || !dest) return null;
      const delayed =
        Boolean(s.promised_delivery_date) &&
        (s.promised_delivery_date as string) < today &&
        !["delivered", "completed", "cancelled"].includes(s.status);
      const mid =
        s.status === "in_transit" || s.status === "picked_up"
          ? midpoint(origin, dest)
          : null;
      return { s, origin, dest, delayed, mid };
    })
    .filter(Boolean) as {
    s: MapShipment;
    origin: LatLng;
    dest: LatLng;
    delayed: boolean;
    mid: LatLng | null;
  }[];

  const allPoints = plotted.flatMap((p) =>
    p.mid ? [p.origin, p.dest, p.mid] : [p.origin, p.dest],
  );

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div>
          <h3 className="card-title text-base">Shipment network map</h3>
          <p className="text-sm opacity-70">
            Lane pins for planning view. OpenStreetMap tiles.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="select select-bordered select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="assigned">Assigned</option>
            <option value="in_transit">In transit</option>
            <option value="delivered">Delivered</option>
            <option value="delayed">Delayed</option>
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
              {plotted.map(({ s, origin, dest, delayed, mid }) => {
                const color = statusColor(s.status, delayed);
                return (
                  <Fragment key={s.id}>
                    <Polyline
                      positions={[
                        [origin.lat, origin.lng],
                        [dest.lat, dest.lng],
                      ]}
                      pathOptions={{ color, weight: 2, opacity: 0.55 }}
                    />
                    <CircleMarker
                      center={[origin.lat, origin.lng]}
                      radius={6}
                      pathOptions={{ color, fillColor: "#fff", fillOpacity: 1, weight: 2 }}
                    >
                      <Popup>
                        <ShipmentPopup s={s} delayed={delayed} point="Pickup" />
                      </Popup>
                    </CircleMarker>
                    <CircleMarker
                      center={[dest.lat, dest.lng]}
                      radius={6}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
                    >
                      <Popup>
                        <ShipmentPopup s={s} delayed={delayed} point="Delivery" />
                      </Popup>
                    </CircleMarker>
                    {mid ? (
                      <CircleMarker
                        center={[mid.lat, mid.lng]}
                        radius={8}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}
                      >
                        <Popup>
                          <ShipmentPopup s={s} delayed={delayed} point="In transit (approx.)" />
                        </Popup>
                      </CircleMarker>
                    ) : null}
                  </Fragment>
                );
              })}
            </MapContainer>
          )}
        </div>
        <p className="text-xs opacity-60">
          Showing {plotted.length} of {filtered.length} filtered shipment(s). Hollow markers =
          pickup; filled = delivery.
        </p>
      </div>
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
