"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatStatusLabel, money, statusBadge } from "@/lib/types";

export type ShipperShipmentRow = {
  id: string;
  load_number: string;
  status: string;
  carrier_name: string | null;
  lane: string;
  pickup_date: string | null;
  delivery_date: string | null;
  next_event: string | null;
};

export type ShipperInvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  balance: number;
  due_date: string;
};

type ShipFilter = "all" | "scheduled" | "assigned" | "in_transit" | "delivered";
type InvoiceFilter = "all" | "pending" | "sent" | "partial" | "overdue" | "paid";

const SHIP_FILTERS: { id: ShipFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "assigned", label: "Assigned" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
];

const INVOICE_FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sent", label: "Sent" },
  { id: "partial", label: "Partial" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
];

function matchesShipFilter(status: string, filter: ShipFilter) {
  if (filter === "all") {
    return ["scheduled", "assigned", "in_transit", "delivered", "completed"].includes(status);
  }
  if (filter === "delivered") {
    return status === "delivered" || status === "completed";
  }
  return status === filter;
}

function matchesInvoiceFilter(row: ShipperInvoiceRow, filter: InvoiceFilter) {
  if (filter === "all") return true;
  return row.status === filter;
}

function FilterChips<T extends string>({
  options,
  value,
  counts,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  counts: Record<T, number>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`btn btn-xs ${value === opt.id ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label} ({counts[opt.id] ?? 0})
        </button>
      ))}
    </div>
  );
}

export function ShipperShipmentsPanel({ rows }: { rows: ShipperShipmentRow[] }) {
  const [filter, setFilter] = useState<ShipFilter>("all");

  const counts = useMemo(() => {
    const next = Object.fromEntries(SHIP_FILTERS.map((f) => [f.id, 0])) as Record<
      ShipFilter,
      number
    >;
    for (const row of rows) {
      for (const f of SHIP_FILTERS) {
        if (matchesShipFilter(row.status, f.id)) next[f.id] += 1;
      }
    }
    return next;
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((r) => matchesShipFilter(r.status, filter)),
    [rows, filter],
  );

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Your shipments</h2>
        <Link href="/shipments" className="btn btn-ghost btn-xs">
          All shipments
        </Link>
      </div>
      <FilterChips
        options={SHIP_FILTERS}
        value={filter}
        counts={counts}
        onChange={setFilter}
      />
      {visible.length === 0 ? (
        <p className="text-sm opacity-70">
          {filter === "all"
            ? "No shipments yet."
            : `No ${SHIP_FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} shipments.`}
        </p>
      ) : (
        <ul className="divide-y divide-base-200">
          {visible.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
                  {s.load_number}
                </Link>
                <p className="text-xs opacity-60">
                  {s.lane}
                  {s.carrier_name ? ` · ${s.carrier_name}` : " · Carrier pending"}
                </p>
                {s.next_event &&
                !["delivered", "completed", "cancelled"].includes(s.status) ? (
                  <p className="text-xs opacity-80">{s.next_event}</p>
                ) : null}
              </div>
              <span className={`badge ${statusBadge(s.status)}`}>
                {formatStatusLabel(s.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShipperInvoicesPanel({ rows }: { rows: ShipperInvoiceRow[] }) {
  const [filter, setFilter] = useState<InvoiceFilter>("all");

  const counts = useMemo(() => {
    const next = Object.fromEntries(INVOICE_FILTERS.map((f) => [f.id, 0])) as Record<
      InvoiceFilter,
      number
    >;
    for (const row of rows) {
      for (const f of INVOICE_FILTERS) {
        if (matchesInvoiceFilter(row, f.id)) next[f.id] += 1;
      }
    }
    return next;
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((r) => matchesInvoiceFilter(r, filter)),
    [rows, filter],
  );

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Your invoices</h2>
        <div className="flex flex-wrap gap-1">
          <Link href="/invoices" className="btn btn-ghost btn-xs">
            All invoices
          </Link>
          <Link href="/support" className="btn btn-ghost btn-xs">
            Support
          </Link>
        </div>
      </div>
      <FilterChips
        options={INVOICE_FILTERS}
        value={filter}
        counts={counts}
        onChange={setFilter}
      />
      {visible.length === 0 ? (
        <p className="text-sm opacity-70">
          {filter === "all"
            ? "No invoices yet."
            : `No ${INVOICE_FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} invoices.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/invoices/${i.id}`} className="link link-primary">
                      {i.invoice_number}
                    </Link>
                  </td>
                  <td>{formatStatusLabel(i.status)}</td>
                  <td>{money(i.balance)}</td>
                  <td>{i.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
