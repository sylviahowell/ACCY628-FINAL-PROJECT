"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PayableWorkItem } from "@/lib/payables";
import { money } from "@/lib/types";

type Filter = "all" | "overdue" | "due_soon" | "high";

export function PayablesWorklist({ items }: { items: PayableWorkItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => {
    if (filter === "overdue") return items.filter((i) => i.daysOutstanding > 0);
    if (filter === "due_soon") {
      return items.filter((i) => i.daysOutstanding <= 0 && i.daysOutstanding > -7);
    }
    if (filter === "high") return items.filter((i) => i.priority === "high");
    return items;
  }, [items, filter]);

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Payables worklist</h3>
            <p className="text-sm opacity-70">
              Open carrier bills ranked for payment. Remit from Accounts Payable.
            </p>
          </div>
          <div className="join">
            {(
              [
                ["all", "All"],
                ["overdue", "Past due"],
                ["due_soon", "Due soon"],
                ["high", "High priority"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn btn-xs join-item ${filter === id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm opacity-70">No carrier bills in this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Bill</th>
                  <th>Load</th>
                  <th>Balance</th>
                  <th>Days</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.billId}
                    id={`focus-${item.billNumber}`}
                    data-focus={item.billNumber}
                    className="hover align-top transition"
                  >
                    <td className="font-medium">{item.carrierName}</td>
                    <td>
                      <span className="font-medium">{item.billNumber}</span>
                      <div className="text-xs opacity-60">{item.status}</div>
                    </td>
                    <td>{item.loadNumber}</td>
                    <td>{money(item.balance)}</td>
                    <td
                      className={
                        item.daysOutstanding > 30
                          ? "font-semibold text-error"
                          : item.daysOutstanding > 0
                            ? "text-warning"
                            : ""
                      }
                    >
                      {item.daysOutstanding}
                    </td>
                    <td className="text-xs">{item.dueDate}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${
                          item.priority === "high"
                            ? "badge-error"
                            : item.priority === "medium"
                              ? "badge-warning"
                              : "badge-ghost"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="space-y-1">
                      <p className="max-w-[10rem] text-xs opacity-70">
                        {item.recommendedAction}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Link href="/ap" className="btn btn-ghost btn-xs">
                          Pay bill
                        </Link>
                        <Link
                          href={`/shipments/${item.shipmentId}`}
                          className="btn btn-outline btn-xs"
                        >
                          Load
                        </Link>
                      </div>
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
