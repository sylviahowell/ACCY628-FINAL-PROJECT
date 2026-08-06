"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DollarSign,
  Package,
  Percent,
  PiggyBank,
  Receipt,
  Timer,
  Truck,
} from "lucide-react";
import {
  ALL_PARTNERS_ID,
  buildMonthlySeries,
  buildPartnerKpis,
  recentShipments,
  sortPartnersByRevenue,
  type ExplorerCarrier,
  type ExplorerCustomer,
  type ExplorerShipment,
  type PartnerMode,
} from "@/lib/customer-performance";
import { money } from "@/lib/types";
import { CustomerKpiCard } from "./CustomerKpiCard";
import { CustomerCenterCharts, CustomerRightCharts } from "./CustomerExplorerCharts";
import { CustomerRecentShipments } from "./CustomerRecentShipments";

export const ALL_CUSTOMERS_ID = ALL_PARTNERS_ID;

function ExplorerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading partner performance">
      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="cpe-kpi h-[4.5rem] animate-pulse bg-base-200/60" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="cpe-panel h-56 animate-pulse bg-base-200/60" />
          <div className="cpe-panel h-56 animate-pulse bg-base-200/60" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="cpe-panel h-56 animate-pulse bg-base-200/60" />
          <div className="cpe-panel h-56 animate-pulse bg-base-200/60" />
        </div>
      </div>
      <div className="cpe-panel h-48 animate-pulse bg-base-200/60" />
    </div>
  );
}

function resolvePartnerId(
  partnerId: string | null | undefined,
  partners: { id: string }[],
): string {
  if (!partnerId || partnerId === ALL_PARTNERS_ID) return ALL_PARTNERS_ID;
  if (partners.some((p) => p.id === partnerId)) return partnerId;
  return ALL_PARTNERS_ID;
}

function syncUrl(mode: PartnerMode, partnerId: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (mode === "shipper") {
    url.searchParams.delete("mode");
  } else {
    url.searchParams.set("mode", "carrier");
  }
  // Legacy + unified partner param
  url.searchParams.delete("customer");
  url.searchParams.delete("partner");
  if (partnerId && partnerId !== ALL_PARTNERS_ID) {
    url.searchParams.set("partner", partnerId);
    if (mode === "shipper") url.searchParams.set("customer", partnerId);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function CustomerPerformanceExplorer({
  customers,
  carriers = [],
  initialCustomerId = null,
  initialMode = "shipper",
  initialPartnerId = null,
}: {
  customers: ExplorerCustomer[];
  carriers?: ExplorerCarrier[];
  /** @deprecated Prefer initialPartnerId with mode=shipper */
  initialCustomerId?: string | null;
  initialMode?: PartnerMode;
  initialPartnerId?: string | null;
}) {
  const shippers = useMemo(() => sortPartnersByRevenue(customers), [customers]);
  const carrierList = useMemo(() => sortPartnersByRevenue(carriers), [carriers]);

  const seedPartner =
    initialPartnerId ??
    (initialMode === "shipper" ? initialCustomerId : null);

  const [mode, setMode] = useState<PartnerMode>(initialMode);
  const [partnerId, setPartnerId] = useState<string>(() =>
    resolvePartnerId(
      seedPartner,
      initialMode === "carrier" ? carrierList : shippers,
    ),
  );
  const [pending, startTransition] = useTransition();
  const [switching, setSwitching] = useState(false);

  const nextPartner = resolvePartnerId(
    initialPartnerId ?? (initialMode === "shipper" ? initialCustomerId : null),
    initialMode === "carrier" ? carrierList : shippers,
  );
  const propSyncKey = `${initialMode}|${nextPartner}|${shippers.length}|${carrierList.length}`;
  const [appliedPropSyncKey, setAppliedPropSyncKey] = useState(propSyncKey);
  if (propSyncKey !== appliedPropSyncKey) {
    setAppliedPropSyncKey(propSyncKey);
    setMode(initialMode);
    setPartnerId(nextPartner);
  }

  const activeList = mode === "carrier" ? carrierList : shippers;

  function beginSwitch(fn: () => void) {
    setSwitching(true);
    startTransition(fn);
    window.setTimeout(() => setSwitching(false), 280);
  }

  function selectMode(next: PartnerMode) {
    if (next === mode) return;
    beginSwitch(() => {
      setMode(next);
      setPartnerId(ALL_PARTNERS_ID);
      syncUrl(next, ALL_PARTNERS_ID);
    });
  }

  function selectPartner(next: string) {
    if (next === partnerId) return;
    beginSwitch(() => {
      setPartnerId(next);
      syncUrl(mode, next);
    });
  }

  const isAll = partnerId === ALL_PARTNERS_ID;
  const selected = isAll ? null : activeList.find((p) => p.id === partnerId) ?? null;

  const activeShipments: ExplorerShipment[] = useMemo(() => {
    if (isAll) return activeList.flatMap((p) => p.shipments);
    return selected?.shipments ?? [];
  }, [isAll, selected, activeList]);

  const hasSelection = isAll || selected != null;
  const kpis = hasSelection ? buildPartnerKpis(activeShipments) : null;
  const series = hasSelection ? buildMonthlySeries(activeShipments, 6) : [];
  const recent = hasSelection
    ? recentShipments(activeShipments, isAll ? 16 : 12)
    : [];
  const showSkeleton = switching || pending;

  const isCarrier = mode === "carrier";
  const showCustomerCol = isCarrier || (mode === "shipper" && isAll);
  const showCarrierCol = !isCarrier || (mode === "carrier" && isAll);

  const totalBuyCost = kpis?.totalCost ?? 0;
  const firstKpiLabel = isCarrier ? "Buy cost (COGS)" : "Revenue";
  const firstKpiValue = isCarrier ? totalBuyCost : kpis?.revenue ?? 0;
  const firstKpiDelta = isCarrier ? kpis?.deltas.totalCost : kpis?.deltas.revenue;
  const profitLabel = isCarrier ? "Gross profit contributed" : "Gross profit";
  const shipmentLabel = isCarrier ? "Shipments hauled" : "Shipments";

  return (
    <section
      id="customer-performance"
      className="cpe-shell space-y-5"
      aria-label="Partner Performance Explorer"
    >
      <div className="cpe-hero flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Executive insight
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Partner Performance Explorer
          </h2>
          <p className="mt-1 max-w-2xl text-sm opacity-70">
            {isCarrier
              ? "Inspect carrier buy-side cost, margin contribution, and delivery reliability."
              : "Inspect customer sell-side revenue, margin, and delivery reliability."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[18rem]">
          <div className="join w-full sm:w-auto" role="group" aria-label="Partner type">
            <button
              type="button"
              className={`btn btn-sm join-item flex-1 ${mode === "shipper" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => selectMode("shipper")}
            >
              Customers
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item flex-1 ${mode === "carrier" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => selectMode("carrier")}
            >
              Carriers
            </button>
          </div>

          <label className="form-control w-full">
            <span className="label py-0 pb-1">
              <span className="label-text text-xs font-medium opacity-70">
                {isCarrier ? "Carrier" : "Customer"}
              </span>
            </span>
            <select
              className="select select-bordered cpe-select"
              aria-label={isCarrier ? "Select carrier" : "Select customer"}
              value={partnerId}
              onChange={(e) => selectPartner(e.target.value)}
            >
              <option value={ALL_PARTNERS_ID}>
                {isCarrier ? "All carriers" : "All customers"}
              </option>
              {activeList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showSkeleton ? (
        <ExplorerSkeleton />
      ) : !hasSelection ? (
        <div className="cpe-empty flex min-h-[18rem] flex-col items-center justify-center gap-2 text-center">
          <p className="text-lg font-semibold tracking-tight">
            Select a partner to explore performance.
          </p>
          <p className="max-w-md text-sm opacity-60">
            Choose All for the network view, or pick one customer or carrier to drill in.
          </p>
        </div>
      ) : (
        <div key={`${mode}-${partnerId}`} className="cpe-fade space-y-4">
          <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <CustomerKpiCard
                label={firstKpiLabel}
                value={firstKpiValue}
                format={money}
                icon={isCarrier ? Truck : DollarSign}
                delta={firstKpiDelta ?? null}
                invertDelta={isCarrier}
              />
              <CustomerKpiCard
                label={profitLabel}
                value={kpis!.grossProfit}
                format={money}
                icon={PiggyBank}
                delta={kpis!.deltas.grossProfit}
              />
              <CustomerKpiCard
                label="Gross margin %"
                value={kpis!.marginPct}
                format={(n) => `${n.toFixed(1)}%`}
                icon={Percent}
                delta={kpis!.deltas.marginPct}
                deltaSuffix=" pts"
              />
              <CustomerKpiCard
                label={shipmentLabel}
                value={kpis!.shipmentCount}
                format={(n) => String(Math.round(n))}
                icon={Package}
                delta={kpis!.deltas.shipmentCount}
              />
              <CustomerKpiCard
                label="Avg revenue / shipment"
                value={kpis!.avgRevenue}
                format={money}
                icon={Receipt}
                delta={kpis!.deltas.avgRevenue}
              />
              {kpis!.onTimePct == null ? (
                <div className="cpe-kpi group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                      On-time delivery %
                    </p>
                    <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">—</p>
                  <p className="mt-1.5 text-xs opacity-50">Need delivered loads with POD dates</p>
                </div>
              ) : (
                <CustomerKpiCard
                  label="On-time delivery %"
                  value={kpis!.onTimePct}
                  format={(n) => `${n.toFixed(1)}%`}
                  icon={Timer}
                  delta={kpis!.deltas.onTimePct}
                  deltaSuffix=" pts"
                />
              )}
              <CustomerKpiCard
                label="Avg cost / shipment"
                value={kpis!.avgCost}
                format={money}
                icon={isCarrier ? DollarSign : Truck}
                delta={kpis!.deltas.avgCost}
                invertDelta
              />
            </div>

            <CustomerCenterCharts series={series} />
            <CustomerRightCharts series={series} />
          </div>

          <CustomerRecentShipments
            shipments={recent}
            showCustomer={showCustomerCol}
            showCarrier={showCarrierCol}
          />
        </div>
      )}
    </section>
  );
}
