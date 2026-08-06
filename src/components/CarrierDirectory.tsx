"use client";

import { useMemo, useState } from "react";
import { CarrierScorecardGrid } from "@/components/CarrierScorecards";
import type { CarrierScorecard, CarrierTier } from "@/lib/carrier-scorecard";

type SortKey = "tier" | "name" | "on_time" | "area" | "cost";

const TIER_ORDER: Record<CarrierTier, number> = {
  Preferred: 0,
  Approved: 1,
  "Watch List": 2,
  Suspended: 3,
};

/**
 * Coverage-oriented lookup: search by name/area/equipment and sort the scorecard list.
 */
export function CarrierDirectory({ scorecards }: { scorecards: CarrierScorecard[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("tier");
  const [tier, setTier] = useState<"all" | CarrierTier>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = scorecards.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (!needle) return true;
      const hay = [
        c.name,
        c.serviceArea ?? "",
        c.equipmentType ?? "",
        c.tier,
        c.insuranceStatus,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "on_time": {
          const av = a.onTimeDeliveryPct ?? -1;
          const bv = b.onTimeDeliveryPct ?? -1;
          return bv - av;
        }
        case "area":
          return (a.serviceArea ?? "zzz").localeCompare(b.serviceArea ?? "zzz");
        case "cost": {
          const av = a.avgCarrierCost ?? Number.POSITIVE_INFINITY;
          const bv = b.avgCarrierCost ?? Number.POSITIVE_INFINITY;
          return av - bv;
        }
        case "tier":
        default: {
          if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) {
            return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
          }
          return a.name.localeCompare(b.name);
        }
      }
    });

    return list;
  }, [scorecards, q, sort, tier]);

  return (
    <div className="space-y-4">
      <div className="rounded-box border border-base-300 bg-base-100 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="form-control min-w-0 flex-1">
            <span className="label py-1">
              <span className="label-text text-xs font-medium opacity-70">
                Look up carrier / coverage
              </span>
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, service area, equipment…"
              className="input input-bordered input-sm w-full"
              aria-label="Search carriers"
            />
          </label>
          <label className="form-control w-full lg:w-44">
            <span className="label py-1">
              <span className="label-text text-xs font-medium opacity-70">Tier</span>
            </span>
            <select
              className="select select-bordered select-sm"
              value={tier}
              onChange={(e) => setTier(e.target.value as "all" | CarrierTier)}
              aria-label="Filter by tier"
            >
              <option value="all">All tiers</option>
              <option value="Preferred">Preferred</option>
              <option value="Approved">Approved</option>
              <option value="Watch List">Watch List</option>
              <option value="Suspended">Suspended</option>
            </select>
          </label>
          <label className="form-control w-full lg:w-52">
            <span className="label py-1">
              <span className="label-text text-xs font-medium opacity-70">Sort by</span>
            </span>
            <select
              className="select select-bordered select-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort carriers"
            >
              <option value="tier">Tier (coverage preferred)</option>
              <option value="name">Name A–Z</option>
              <option value="on_time">On-time delivery</option>
              <option value="area">Service area</option>
              <option value="cost">Avg carrier cost</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs opacity-60">
          Showing {filtered.length} of {scorecards.length} carrier
          {scorecards.length === 1 ? "" : "s"}
          {q.trim() ? ` matching “${q.trim()}”` : ""}
          {tier !== "all" ? ` · ${tier}` : ""}.
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100 px-4 py-8 text-center text-sm opacity-70">
          No carriers match this lookup. Try a different name, area, or clear the filters.
        </div>
      ) : (
        <CarrierScorecardGrid scorecards={filtered} showComparison={!q.trim() && tier === "all"} />
      )}
    </div>
  );
}
