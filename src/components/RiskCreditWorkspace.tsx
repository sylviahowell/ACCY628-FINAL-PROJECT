"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CarrierRiskRow,
  type CreditStatus,
  type CustomerCreditRow,
  type InsuranceRiskStatus,
  creditStatusBadge,
  creditStatusLabel,
  formatMoney,
  insuranceStatusBadge,
  insuranceStatusLabel,
} from "@/lib/risk-credit";

type CreditFilter = "all" | CreditStatus | "hold";
type CarrierFilter = "all" | InsuranceRiskStatus;
type CreditSort = "risk" | "name" | "utilization" | "openAr";
type CarrierSort = "risk" | "name" | "expiry" | "activeLoads";

const CREDIT_RISK_ORDER: Record<CreditStatus, number> = {
  over: 0,
  watch: 1,
  no_limit: 2,
  ok: 3,
};

const CARRIER_RISK_ORDER: Record<InsuranceRiskStatus, number> = {
  expired: 0,
  expiring: 1,
  unknown: 2,
  current: 3,
};

export function RiskCreditWorkspace({
  customers,
  carriers,
  focusId = null,
}: {
  customers: CustomerCreditRow[];
  carriers: CarrierRiskRow[];
  focusId?: string | null;
}) {
  const [creditFilter, setCreditFilter] = useState<CreditFilter>("all");
  const [carrierFilter, setCarrierFilter] = useState<CarrierFilter>("all");
  const [creditSort, setCreditSort] = useState<CreditSort>("risk");
  const [carrierSort, setCarrierSort] = useState<CarrierSort>("risk");
  const [creditQuery, setCreditQuery] = useState("");
  const [carrierQuery, setCarrierQuery] = useState("");

  useEffect(() => {
    if (!focusId) return;
    const customer = customers.find((c) => c.id === focusId);
    if (customer) {
      setCreditFilter(
        customer.onCreditHold ? "hold" : customer.status === "ok" ? "all" : customer.status,
      );
      setCreditQuery("");
      return;
    }
    const carrier = carriers.find((c) => c.id === focusId);
    if (carrier) {
      setCarrierFilter(carrier.status === "current" ? "all" : carrier.status);
      setCarrierQuery("");
    }
  }, [focusId, customers, carriers]);

  const creditCounts = useMemo(() => {
    const counts = {
      all: customers.length,
      over: 0,
      watch: 0,
      ok: 0,
      no_limit: 0,
      hold: 0,
    };
    for (const c of customers) {
      counts[c.status] += 1;
      if (c.onCreditHold) counts.hold += 1;
    }
    return counts;
  }, [customers]);

  const carrierCounts = useMemo(() => {
    const counts = {
      all: carriers.length,
      expired: 0,
      expiring: 0,
      current: 0,
      unknown: 0,
    };
    for (const c of carriers) counts[c.status] += 1;
    return counts;
  }, [carriers]);

  const visibleCustomers = useMemo(() => {
    const q = creditQuery.trim().toLowerCase();
    let rows =
      creditFilter === "all"
        ? customers
        : creditFilter === "hold"
          ? customers.filter((c) => c.onCreditHold)
          : customers.filter((c) => c.status === creditFilter);
    if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    if (focusId && !rows.some((c) => c.id === focusId)) {
      const focused = customers.find((c) => c.id === focusId);
      if (focused) rows = [focused, ...rows];
    }
    return [...rows].sort((a, b) => {
      if (creditSort === "name") return a.name.localeCompare(b.name);
      if (creditSort === "openAr") return b.openAr - a.openAr;
      if (creditSort === "utilization") {
        return (b.utilizationPct ?? -1) - (a.utilizationPct ?? -1);
      }
      const risk = CREDIT_RISK_ORDER[a.status] - CREDIT_RISK_ORDER[b.status];
      if (risk !== 0) return risk;
      return b.openAr - a.openAr;
    });
  }, [customers, creditFilter, creditQuery, creditSort, focusId]);

  const visibleCarriers = useMemo(() => {
    const q = carrierQuery.trim().toLowerCase();
    let rows =
      carrierFilter === "all"
        ? carriers
        : carriers.filter((c) => c.status === carrierFilter);
    if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    if (focusId && !rows.some((c) => c.id === focusId)) {
      const focused = carriers.find((c) => c.id === focusId);
      if (focused) rows = [focused, ...rows];
    }
    return [...rows].sort((a, b) => {
      if (carrierSort === "name") return a.name.localeCompare(b.name);
      if (carrierSort === "activeLoads") return b.activeLoads - a.activeLoads;
      if (carrierSort === "expiry") {
        const ae = a.insuranceExpiration ?? "9999-99-99";
        const be = b.insuranceExpiration ?? "9999-99-99";
        return ae.localeCompare(be);
      }
      const risk = CARRIER_RISK_ORDER[a.status] - CARRIER_RISK_ORDER[b.status];
      if (risk !== 0) return risk;
      return (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999);
    });
  }, [carriers, carrierFilter, carrierQuery, carrierSort, focusId]);

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat rounded-box border border-base-300 bg-base-100 py-3 shadow-sm">
          <div className="stat-title text-xs">Customers over limit</div>
          <div className="stat-value text-2xl text-error">{creditCounts.over}</div>
        </div>
        <div className="stat rounded-box border border-base-300 bg-base-100 py-3 shadow-sm">
          <div className="stat-title text-xs">On credit hold</div>
          <div className="stat-value text-2xl text-warning">{creditCounts.hold}</div>
        </div>
        <div className="stat rounded-box border border-base-300 bg-base-100 py-3 shadow-sm">
          <div className="stat-title text-xs">Carriers expired</div>
          <div className="stat-value text-2xl text-error">{carrierCounts.expired}</div>
        </div>
        <div className="stat rounded-box border border-base-300 bg-base-100 py-3 shadow-sm">
          <div className="stat-title text-xs">Carriers expiring ≤30d</div>
          <div className="stat-value text-2xl text-warning">{carrierCounts.expiring}</div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Customer credit exposure</h2>
          <p className="text-sm opacity-70">
            Open AR vs credit limit, plus past-due credit holds. Booking is blocked for brokers when
            open AR + new rate exceeds the limit or past-due meets the hold threshold, unless a
            manager overrides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "All", creditCounts.all],
              ["hold", "Credit hold", creditCounts.hold],
              ["over", "Over limit", creditCounts.over],
              ["watch", "Watch", creditCounts.watch],
              ["ok", "OK", creditCounts.ok],
              ["no_limit", "No limit", creditCounts.no_limit],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-xs ${creditFilter === id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCreditFilter(id)}
            >
              {label} ({count})
            </button>
          ))}
          <input
            className="input input-bordered input-xs ml-auto min-w-[10rem] max-w-xs"
            placeholder="Filter by customer name"
            value={creditQuery}
            onChange={(e) => setCreditQuery(e.target.value)}
            aria-label="Filter customers by name"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <span className="opacity-70">Sort</span>
            <select
              className="select select-bordered select-xs"
              value={creditSort}
              onChange={(e) => setCreditSort(e.target.value as CreditSort)}
              aria-label="Sort customers"
            >
              <option value="risk">Risk</option>
              <option value="utilization">Utilization</option>
              <option value="openAr">Open AR</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Credit limit</th>
                <th>Open AR</th>
                <th>Past due</th>
                <th>Utilization</th>
                <th>Status</th>
                <th>Terms</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-sm opacity-60 py-8">
                    No customers match this filter.
                  </td>
                </tr>
              ) : (
                visibleCustomers.map((c) => (
                  <tr
                    key={c.id}
                    id={`focus-${c.id}`}
                    data-focus={c.id}
                    className="hover"
                  >
                    <td className="font-medium">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {c.name}
                        {c.onCreditHold ? (
                          <span className="badge badge-warning badge-sm">Credit hold</span>
                        ) : null}
                      </span>
                    </td>
                    <td>{c.creditLimit > 0 ? formatMoney(c.creditLimit) : "—"}</td>
                    <td>{formatMoney(c.openAr)}</td>
                    <td>{formatMoney(c.pastDue)}</td>
                    <td>
                      {c.utilizationPct == null ? "—" : `${c.utilizationPct.toFixed(1)}%`}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${creditStatusBadge(c.status)}`}>
                        {creditStatusLabel(c.status)}
                      </span>
                    </td>
                    <td className="text-xs opacity-70">{c.paymentTerms}</td>
                    <td className="text-right">
                      <Link
                        href={`/customers?customer=${encodeURIComponent(c.id)}`}
                        className="btn btn-ghost btn-xs"
                      >
                        Open
                      </Link>
                      <Link
                        href={`/ar?customer=${encodeURIComponent(c.id)}`}
                        className="btn btn-ghost btn-xs"
                      >
                        AR
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Carrier insurance & network risk</h2>
          <p className="text-sm opacity-70">
            Certificate status for every carrier. Expired or soon-expiring cover is a booking
            warning — review before assigning loads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "All", carrierCounts.all],
              ["expired", "Expired", carrierCounts.expired],
              ["expiring", "Expiring", carrierCounts.expiring],
              ["current", "Current", carrierCounts.current],
              ["unknown", "Unknown", carrierCounts.unknown],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-xs ${carrierFilter === id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCarrierFilter(id)}
            >
              {label} ({count})
            </button>
          ))}
          <input
            className="input input-bordered input-xs ml-auto min-w-[10rem] max-w-xs"
            placeholder="Filter by carrier name"
            value={carrierQuery}
            onChange={(e) => setCarrierQuery(e.target.value)}
            aria-label="Filter carriers by name"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <span className="opacity-70">Sort</span>
            <select
              className="select select-bordered select-xs"
              value={carrierSort}
              onChange={(e) => setCarrierSort(e.target.value as CarrierSort)}
              aria-label="Sort carriers"
            >
              <option value="risk">Risk</option>
              <option value="expiry">Expiration</option>
              <option value="activeLoads">Active loads</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Insurance expires</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Active loads</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleCarriers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm opacity-60 py-8">
                    No carriers match this filter.
                  </td>
                </tr>
              ) : (
                visibleCarriers.map((c) => (
                  <tr
                    key={c.id}
                    id={`focus-${c.id}`}
                    data-focus={c.id}
                    className="hover"
                  >
                    <td className="font-medium">{c.name}</td>
                    <td>{c.insuranceExpiration ?? "—"}</td>
                    <td>
                      <span className={`badge badge-sm ${insuranceStatusBadge(c.status)}`}>
                        {insuranceStatusLabel(c.status)}
                      </span>
                    </td>
                    <td>{c.rating == null ? "—" : c.rating.toFixed(1)}</td>
                    <td>{c.activeLoads}</td>
                    <td className="text-right">
                      <Link href="/carriers" className="btn btn-ghost btn-xs">
                        Open
                      </Link>
                      <Link href="/shipments" className="btn btn-ghost btn-xs">
                        Shipments
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
