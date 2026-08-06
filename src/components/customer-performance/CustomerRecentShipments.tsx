"use client";

import type { ExplorerShipment } from "@/lib/customer-performance";
import { money } from "@/lib/types";

function statusBadge(display: ExplorerShipment["displayStatus"], raw: string) {
  if (display === "delivered") {
    return { className: "badge-success", label: "Delivered" };
  }
  if (display === "delayed") {
    return { className: "badge-warning text-warning-content", label: "Delayed" };
  }
  if (display === "in_transit") {
    return { className: "badge-info", label: "In Transit" };
  }
  return { className: "badge-ghost", label: raw.replace(/_/g, " ") };
}

export function CustomerRecentShipments({
  shipments,
  showCustomer = false,
  showCarrier = true,
}: {
  shipments: ExplorerShipment[];
  showCustomer?: boolean;
  showCarrier?: boolean;
}) {
  const colSpan = 5 + (showCustomer ? 1 : 0) + (showCarrier ? 1 : 0);

  return (
    <div className="cpe-panel">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold tracking-tight">Recent shipments</h4>
          <p className="text-xs opacity-60">Latest loads for this partner view</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Shipment ID</th>
              {showCustomer ? <th>Customer</th> : null}
              <th>Origin</th>
              <th>Destination</th>
              {showCarrier ? <th>Carrier</th> : null}
              <th>Revenue</th>
              <th>Profit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => {
              const badge = statusBadge(s.displayStatus, s.status);
              return (
                <tr key={s.id} className="hover:bg-base-200/40">
                  <td className="font-mono text-xs font-medium">{s.loadNumber}</td>
                  {showCustomer ? <td>{s.customerName}</td> : null}
                  <td>{s.origin}</td>
                  <td>{s.destination}</td>
                  {showCarrier ? <td>{s.carrier}</td> : null}
                  <td className="tabular-nums">{money(s.revenue)}</td>
                  <td
                    className={`tabular-nums font-medium ${
                      s.profit < 0 ? "text-error" : "text-success"
                    }`}
                  >
                    {money(s.profit)}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${badge.className}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-sm opacity-60">
                  No shipments for this view yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
