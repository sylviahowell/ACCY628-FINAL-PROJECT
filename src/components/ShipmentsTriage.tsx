"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FocusScroll } from "@/components/FocusScroll";
import { statusBadge } from "@/lib/types";

export type ShipmentListRow = {
  id: string;
  loadNumber: string;
  laneFrom: string;
  laneTo: string;
  customerName: string;
  carrierName: string;
  status: string;
  rateDisplay: string;
  hasPod: boolean;
  readyToBill: boolean;
  isDelayed: boolean;
  needsCoverage: boolean;
};

export type ShipStatusFilter = "all" | "delayed" | "unassigned" | "ready";

function initialStatus(status: string | null, filter: string | null): ShipStatusFilter {
  if (status === "delayed" || status === "unassigned" || status === "ready") {
    return status;
  }
  if (filter === "delayed" || filter === "unassigned") return filter;
  if (filter === "ready-to-bill") return "ready";
  return "all";
}

function matchesFilter(row: ShipmentListRow, filter: ShipStatusFilter) {
  if (filter === "all") return true;
  if (filter === "delayed") return row.isDelayed;
  if (filter === "unassigned") return row.needsCoverage;
  if (filter === "ready") return row.readyToBill;
  return true;
}

function sortRows(rows: ShipmentListRow[], focus: string | null) {
  return [...rows].sort((a, b) => {
    if (focus) {
      if (a.loadNumber === focus && b.loadNumber !== focus) return -1;
      if (b.loadNumber === focus && a.loadNumber !== focus) return 1;
    }
    if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1;
    if (a.needsCoverage !== b.needsCoverage) return a.needsCoverage ? -1 : 1;
    return a.loadNumber.localeCompare(b.loadNumber);
  });
}

export function ShipmentsTriage({
  rows,
  rateHeader,
  showDocsReady,
}: {
  rows: ShipmentListRow[];
  rateHeader: string;
  showDocsReady: boolean;
}) {
  return (
    <Suspense
      fallback={
        <ShipmentsBody
          rows={sortRows(rows, null)}
          filter="all"
          rateHeader={rateHeader}
          showDocsReady={showDocsReady}
          onFilter={() => {}}
        />
      }
    >
      <ShipmentsTriageInner rows={rows} rateHeader={rateHeader} showDocsReady={showDocsReady} />
    </Suspense>
  );
}

function ShipmentsTriageInner({
  rows,
  rateHeader,
  showDocsReady,
}: {
  rows: ShipmentListRow[];
  rateHeader: string;
  showDocsReady: boolean;
}) {
  const params = useSearchParams();
  const urlFilter = initialStatus(params.get("status"), params.get("filter"));
  const [filter, setFilter] = useState<ShipStatusFilter>(urlFilter);
  const [prevUrlFilter, setPrevUrlFilter] = useState(urlFilter);
  if (urlFilter !== prevUrlFilter) {
    setPrevUrlFilter(urlFilter);
    setFilter(urlFilter);
  }
  const focus = params.get("focus");

  const delayed = rows.filter((r) => r.isDelayed).length;
  const unassigned = rows.filter((r) => r.needsCoverage).length;
  const ready = rows.filter((r) => r.readyToBill).length;

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => matchesFilter(r, filter));
    return sortRows(filtered, focus);
  }, [rows, filter, focus]);

  return (
    <>
      <FocusScroll />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", rows.length],
            ["delayed", "Delayed", delayed],
            ["unassigned", "Needs coverage", unassigned],
            ["ready", "Ready to bill", ready],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-xs ${filter === id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(id)}
          >
            {label} ({count})
          </button>
        ))}
      </div>
      <ShipmentsBody
        rows={visible}
        filter={filter}
        rateHeader={rateHeader}
        showDocsReady={showDocsReady}
        onFilter={setFilter}
      />
    </>
  );
}

function ShipmentsBody({
  rows,
  filter,
  rateHeader,
  showDocsReady,
}: {
  rows: ShipmentListRow[];
  filter: ShipStatusFilter;
  rateHeader: string;
  showDocsReady: boolean;
  onFilter: (f: ShipStatusFilter) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm opacity-70">
        {filter === "all" ? "No shipments to show." : `No loads in “${filter}”.`}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-box bg-base-100 shadow-sm">
      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Lane</th>
            <th>Parties</th>
            <th>Status</th>
            <th>{rateHeader}</th>
            {showDocsReady ? <th>Docs / Ready</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              id={`focus-${s.loadNumber}`}
              data-focus={s.loadNumber}
              className="hover"
            >
              <td>
                <Link href={`/shipments/${s.id}`} className="link link-primary font-medium">
                  {s.loadNumber}
                </Link>
              </td>
              <td className="text-sm">
                {s.laneFrom}
                <div className="opacity-60">→ {s.laneTo}</div>
              </td>
              <td className="text-sm">
                {s.customerName}
                <div className="opacity-60">{s.carrierName}</div>
              </td>
              <td>
                <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                {s.isDelayed ? (
                  <span className="badge badge-error badge-sm ml-1">delayed</span>
                ) : null}
              </td>
              <td className="text-sm">{s.rateDisplay}</td>
              {showDocsReady ? (
                <td className="text-sm">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`badge badge-sm ${s.hasPod ? "badge-success" : "badge-ghost"}`}>
                      POD {s.hasPod ? "yes" : "no"}
                    </span>
                    {s.readyToBill ? (
                      <span className="badge badge-sm badge-primary">Ready to bill</span>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

