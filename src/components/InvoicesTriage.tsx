"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { FocusScroll } from "@/components/FocusScroll";

export type InvoiceFilter = "all" | "ready" | "overdue" | "open";

export type InvoiceCardMeta = {
  id: string;
  isOverdue: boolean;
  isOpen: boolean;
  card: ReactNode;
};

function initialFilter(status: string | null, filter: string | null): InvoiceFilter {
  if (status === "ready" || status === "overdue" || status === "open") return status;
  if (filter === "ready-to-bill") return "ready";
  if (filter === "overdue" || filter === "open") return filter;
  return "all";
}

export function InvoicesTriage({
  readyCount,
  overdueCount,
  openCount,
  showReady,
  readySection,
  invoices,
  emptyAll,
}: {
  readyCount: number;
  overdueCount: number;
  openCount: number;
  showReady: boolean;
  readySection: ReactNode;
  invoices: InvoiceCardMeta[];
  emptyAll: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <InvoicesBody
          filter="all"
          showReady={showReady}
          readySection={readySection}
          invoices={invoices}
          emptyAll={emptyAll}
          onFilter={() => {}}
          readyCount={readyCount}
          overdueCount={overdueCount}
          openCount={openCount}
          totalCount={invoices.length}
        />
      }
    >
      <InvoicesTriageInner
        readyCount={readyCount}
        overdueCount={overdueCount}
        openCount={openCount}
        showReady={showReady}
        readySection={readySection}
        invoices={invoices}
        emptyAll={emptyAll}
      />
    </Suspense>
  );
}

function InvoicesTriageInner({
  readyCount,
  overdueCount,
  openCount,
  showReady,
  readySection,
  invoices,
  emptyAll,
}: {
  readyCount: number;
  overdueCount: number;
  openCount: number;
  showReady: boolean;
  readySection: ReactNode;
  invoices: InvoiceCardMeta[];
  emptyAll: ReactNode;
}) {
  const params = useSearchParams();
  const [filter, setFilter] = useState<InvoiceFilter>(() =>
    initialFilter(params.get("status"), params.get("filter")),
  );

  useEffect(() => {
    setFilter(initialFilter(params.get("status"), params.get("filter")));
  }, [params]);

  return (
    <>
      <FocusScroll />
      <InvoicesBody
        filter={filter}
        onFilter={setFilter}
        showReady={showReady}
        readySection={readySection}
        invoices={invoices}
        emptyAll={emptyAll}
        readyCount={readyCount}
        overdueCount={overdueCount}
        openCount={openCount}
        totalCount={invoices.length}
      />
    </>
  );
}

function InvoicesBody({
  filter,
  onFilter,
  showReady,
  readySection,
  invoices,
  emptyAll,
  readyCount,
  overdueCount,
  openCount,
  totalCount,
}: {
  filter: InvoiceFilter;
  onFilter: (f: InvoiceFilter) => void;
  showReady: boolean;
  readySection: ReactNode;
  invoices: InvoiceCardMeta[];
  emptyAll: ReactNode;
  readyCount: number;
  overdueCount: number;
  openCount: number;
  totalCount: number;
}) {
  const visible = useMemo(() => {
    if (filter === "overdue") return invoices.filter((i) => i.isOverdue);
    if (filter === "open") return invoices.filter((i) => i.isOpen);
    if (filter === "ready") return [];
    return invoices;
  }, [invoices, filter]);

  const showReadyBlock = showReady && (filter === "all" || filter === "ready");
  const showInvoiceList = filter !== "ready";

  const chips: { id: InvoiceFilter; label: string; count: number; hide?: boolean }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "ready", label: "Ready to bill", count: readyCount, hide: !showReady },
    { id: "overdue", label: "Overdue", count: overdueCount },
    { id: "open", label: "Outstanding", count: openCount },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips
          .filter((c) => !c.hide)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn btn-xs ${filter === c.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onFilter(c.id)}
            >
              {c.label} ({c.count})
            </button>
          ))}
      </div>

      {showReadyBlock ? readySection : null}

      {showInvoiceList ? (
        <div className="space-y-4">
          {visible.map((i) => (
            <div key={i.id}>{i.card}</div>
          ))}
          {visible.length === 0 && filter === "all" ? emptyAll : null}
          {visible.length === 0 && filter !== "all" ? (
            <p className="text-sm opacity-70">No invoices in this filter.</p>
          ) : null}
        </div>
      ) : null}

      {filter === "ready" && readyCount === 0 ? (
        <p className="text-sm opacity-70">No loads ready to bill right now.</p>
      ) : null}
    </div>
  );
}
