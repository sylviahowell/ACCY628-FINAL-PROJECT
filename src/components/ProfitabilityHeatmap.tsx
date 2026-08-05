"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bandClasses,
  buildHeatmap,
  type HeatDimension,
  type HeatCell,
} from "@/lib/heatmap";
import { money } from "@/lib/types";

type HeatRowInput = Parameters<typeof buildHeatmap>[0][number];

const DIMENSIONS: { id: HeatDimension; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "lane", label: "Lane" },
  { id: "carrier", label: "Carrier" },
  { id: "month", label: "Month" },
  { id: "shipment", label: "Shipment" },
];

export function ProfitabilityHeatmap({ rows }: { rows: HeatRowInput[] }) {
  const [dimension, setDimension] = useState<HeatDimension>("customer");
  const cells = useMemo(() => buildHeatmap(rows, dimension), [rows, dimension]);

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Profitability heatmap</h3>
            <p className="text-sm opacity-70">
              Gross profit = customer revenue − carrier cost − approved direct costs. Colors and
              labels both show margin band.
            </p>
          </div>
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

        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              "Strong Profit",
              "Acceptable",
              "Low Margin",
              "Unprofitable",
            ] as HeatCell["band"][]
          ).map((b) => (
            <span key={b} className={`badge badge-outline ${bandClasses(b)}`}>
              {b}
            </span>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {cells.map((cell) => (
            <Link
              key={cell.key}
              href={cell.href}
              className={`rounded-box border p-3 transition hover:brightness-95 ${bandClasses(cell.band)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{cell.label}</p>
                <span className="badge badge-sm badge-ghost shrink-0">{cell.band}</span>
              </div>
              <p className="mt-1 text-sm font-medium">
                Margin {cell.marginPct.toFixed(1)}% · {cell.shipments} load
                {cell.shipments === 1 ? "" : "s"}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs opacity-80">
                <div>
                  <dt>Revenue</dt>
                  <dd className="font-medium">{money(cell.revenue)}</dd>
                </div>
                <div>
                  <dt>Carrier cost</dt>
                  <dd className="font-medium">{money(cell.carrierCost)}</dd>
                </div>
                <div>
                  <dt>Other direct</dt>
                  <dd className="font-medium">{money(cell.otherDirect)}</dd>
                </div>
                <div>
                  <dt>Gross profit</dt>
                  <dd className="font-medium">{money(cell.grossProfit)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
