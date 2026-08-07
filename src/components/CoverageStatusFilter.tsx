"use client";

import {
  Children,
  Suspense,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type CoverageStatusFilterId =
  | "all"
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

function parseStatus(param: string | null): CoverageStatusFilterId {
  if (param === "pending" || param === "accepted" || param === "declined" || param === "cancelled") {
    return param;
  }
  if (param === "approved") return "accepted";
  return "all";
}

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  accepted: 1,
  declined: 2,
  cancelled: 3,
};

function statusOf(child: ReactElement<{ "data-status"?: string }>) {
  return child.props["data-status"] ?? "";
}

function sortChildren(children: ReactElement<{ "data-status"?: string }>[]) {
  return [...children].sort((a, b) => {
    const ra = STATUS_RANK[statusOf(a)] ?? 99;
    const rb = STATUS_RANK[statusOf(b)] ?? 99;
    return ra - rb;
  });
}

export function CoverageStatusFilter({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<CoverageStatusBody items={asStatusChildren(children)} filter="all" />}>
      <CoverageStatusFilterInner>{children}</CoverageStatusFilterInner>
    </Suspense>
  );
}

function asStatusChildren(children: ReactNode) {
  return sortChildren(
    Children.toArray(children).filter((child): child is ReactElement<{ "data-status"?: string }> =>
      isValidElement(child),
    ),
  );
}

function CoverageStatusFilterInner({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [filter, setFilter] = useState<CoverageStatusFilterId>(() =>
    parseStatus(params.get("status")),
  );

  const items = useMemo(() => asStatusChildren(children), [children]);

  const counts = useMemo(() => {
    const c = {
      all: items.length,
      pending: 0,
      accepted: 0,
      declined: 0,
      cancelled: 0,
    };
    for (const item of items) {
      const status = statusOf(item);
      if (status === "pending") c.pending += 1;
      else if (status === "accepted") c.accepted += 1;
      else if (status === "declined") c.declined += 1;
      else if (status === "cancelled") c.cancelled += 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => statusOf(item) === filter)),
    [items, filter],
  );

  function applyFilter(next: CoverageStatusFilterId) {
    setFilter(next);
    // Sync URL immediately (avoid async router.replace races when clicking tabs quickly).
    const qs = new URLSearchParams(params.toString());
    if (next === "all") qs.delete("status");
    else qs.set("status", next);
    const query = qs.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    window.history.replaceState(window.history.state, "", href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter load requests by status">
        {(
          [
            ["all", "All", counts.all],
            ["pending", "Pending", counts.pending],
            ["accepted", "Approved", counts.accepted],
            ["declined", "Declined", counts.declined],
            ["cancelled", "Cancelled", counts.cancelled],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`btn btn-xs ${filter === id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => applyFilter(id)}
          >
            {label} ({count})
          </button>
        ))}
      </div>
      <CoverageStatusBody items={visible} filter={filter} />
    </div>
  );
}

function CoverageStatusBody({
  items,
  filter,
}: {
  items: ReactElement[];
  filter: CoverageStatusFilterId;
}) {
  if (items.length === 0) {
    const label =
      filter === "accepted"
        ? "approved requests"
        : filter === "all"
          ? "load requests"
          : `${filter} requests`;
    return (
      <p className="text-sm opacity-70">
        {filter === "all" ? "No load requests yet." : `No ${label} in this filter.`}
      </p>
    );
  }

  return <ul className="space-y-3">{items}</ul>;
}
