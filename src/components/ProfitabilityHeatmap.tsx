"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bandClasses,
  buildHeatmap,
  type HeatDimension,
  type HeatCell,
  type MarginBand,
} from "@/lib/heatmap";
import { money } from "@/lib/types";

type HeatRowInput = Parameters<typeof buildHeatmap>[0][number];

type SortKey =
  | "label"
  | "shipments"
  | "revenue"
  | "carrierCost"
  | "otherDirect"
  | "grossProfit"
  | "marginPct";

const DIMENSIONS: { id: HeatDimension; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "lane", label: "Lane" },
  { id: "carrier", label: "Carrier" },
  { id: "month", label: "Month" },
  { id: "shipment", label: "Shipment" },
];

const SORT_OPTIONS: { id: SortKey; label: string; defaultDir: "asc" | "desc" }[] = [
  { id: "marginPct", label: "Margin %", defaultDir: "asc" },
  { id: "grossProfit", label: "Gross profit", defaultDir: "asc" },
  { id: "revenue", label: "Revenue", defaultDir: "desc" },
  { id: "carrierCost", label: "Carrier cost", defaultDir: "desc" },
  { id: "otherDirect", label: "Other direct", defaultDir: "desc" },
  { id: "shipments", label: "Loads", defaultDir: "desc" },
  { id: "label", label: "Name", defaultDir: "asc" },
];

const BANDS: MarginBand[] = ["Unprofitable", "Low Margin", "Acceptable", "Strong Profit"];

function rowBandClasses(band: MarginBand) {
  switch (band) {
    case "Strong Profit":
      return "bg-success/15 hover:bg-success/25";
    case "Acceptable":
      return "bg-info/15 hover:bg-info/25";
    case "Low Margin":
      return "bg-warning/20 hover:bg-warning/30";
    default:
      return "bg-error/15 hover:bg-error/25";
  }
}

function marginPillClasses(band: MarginBand) {
  switch (band) {
    case "Strong Profit":
      return "badge-success";
    case "Acceptable":
      return "badge-info";
    case "Low Margin":
      return "badge-warning";
    default:
      return "badge-error";
  }
}

function compareCells(a: HeatCell, b: HeatCell, key: SortKey, dir: "asc" | "desc") {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "label") {
    return mul * a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  }
  return mul * (Number(a[key]) - Number(b[key]));
}

export function ProfitabilityHeatmap({ rows }: { rows: HeatRowInput[] }) {
  const [dimension, setDimension] = useState<HeatDimension>("customer");
  const [sortKey, setSortKey] = useState<SortKey>("marginPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const baseCells = useMemo(() => buildHeatmap(rows, dimension), [rows, dimension]);
  const cells = useMemo(
    () => [...baseCells].sort((a, b) => compareCells(a, b, sortKey, sortDir)),
    [baseCells, sortKey, sortDir],
  );
  const dimLabel = DIMENSIONS.find((d) => d.id === dimension)?.label ?? "Customer";

  function onSortSelect(next: SortKey) {
    const opt = SORT_OPTIONS.find((o) => o.id === next);
    setSortKey(next);
    setSortDir(opt?.defaultDir ?? "asc");
  }

  function onHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    onSortSelect(key);
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const sortSummary =
    sortKey === "marginPct" && sortDir === "asc"
      ? "worst margin first"
      : sortKey === "marginPct" && sortDir === "desc"
        ? "best margin first"
        : `${SORT_OPTIONS.find((o) => o.id === sortKey)?.label ?? "value"} ${
            sortDir === "asc" ? "low → high" : "high → low"
          }`;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Margin by {dimLabel.toLowerCase()}</h3>
            <p className="text-sm opacity-70">
              Gross profit = customer revenue − carrier cost − approved direct costs. Color-coded by
              margin band · sorted {sortSummary}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="opacity-70">Sort by</span>
              <select
                className="select select-bordered select-xs"
                value={sortKey}
                onChange={(e) => onSortSelect(e.target.value as SortKey)}
                aria-label="Sort profitability rows"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label="Toggle sort direction"
            >
              {sortDir === "asc" ? "Ascending" : "Descending"}
            </button>
            <div className="join">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`btn btn-xs join-item ${dimension === d.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setDimension(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {BANDS.map((b) => (
            <span key={b} className={`badge badge-outline ${bandClasses(b)}`}>
              {b}
            </span>
          ))}
        </div>

        {cells.length === 0 ? (
          <p className="text-sm opacity-70">No profitability rows for this view yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr className="bg-base-200/80">
                  <th>
                    <button type="button" className="font-bold" onClick={() => onHeaderClick("label")}>
                      {dimLabel}
                      {sortMark("label")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("shipments")}
                    >
                      Loads{sortMark("shipments")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("revenue")}
                    >
                      Revenue{sortMark("revenue")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("carrierCost")}
                    >
                      Carrier cost{sortMark("carrierCost")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("otherDirect")}
                    >
                      Other direct{sortMark("otherDirect")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("grossProfit")}
                    >
                      Gross profit{sortMark("grossProfit")}
                    </button>
                  </th>
                  <th className="text-right">
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => onHeaderClick("marginPct")}
                    >
                      Margin{sortMark("marginPct")}
                    </button>
                  </th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((cell: HeatCell) => (
                  <tr key={cell.key} className={`transition ${rowBandClasses(cell.band)}`}>
                    <td className="font-medium">
                      <Link href={cell.href} className="link link-hover">
                        {cell.label}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{cell.shipments}</td>
                    <td className="text-right tabular-nums">{money(cell.revenue)}</td>
                    <td className="text-right tabular-nums">{money(cell.carrierCost)}</td>
                    <td className="text-right tabular-nums">{money(cell.otherDirect)}</td>
                    <td
                      className={`text-right tabular-nums font-medium ${
                        cell.grossProfit < 0 ? "text-error" : ""
                      }`}
                    >
                      {money(cell.grossProfit)}
                    </td>
                    <td
                      className={`text-right tabular-nums font-semibold ${
                        cell.marginPct < 0 ? "text-error" : ""
                      }`}
                    >
                      {cell.marginPct.toFixed(1)}%
                    </td>
                    <td>
                      <span className={`badge badge-sm ${marginPillClasses(cell.band)}`}>
                        {cell.band}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
