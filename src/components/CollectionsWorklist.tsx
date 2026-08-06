"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CollectionWorkItem } from "@/lib/collections";
import { money, formatStatusLabel } from "@/lib/types";
import { addCollectionNote, writeOffInvoice } from "@/lib/actions/freight";

type Filter = "all" | "overdue" | "disputed" | "high";

function collectionStatus(item: CollectionWorkItem): {
  label: "Current" | "Outstanding" | "Disputed";
  badgeClass: string;
} {
  if (item.disputeStatus === "open") {
    return { label: "Disputed", badgeClass: "badge-warning" };
  }
  if (item.daysOutstanding > 0) {
    return { label: "Outstanding", badgeClass: "badge-error" };
  }
  return { label: "Current", badgeClass: "badge-success" };
}

export function CollectionsWorklist({ items }: { items: CollectionWorkItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => {
    if (filter === "overdue") return items.filter((i) => i.daysOutstanding > 0);
    if (filter === "disputed") return items.filter((i) => i.disputeStatus === "open");
    if (filter === "high") return items.filter((i) => i.priority === "high");
    return items;
  }, [items, filter]);

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Collections worklist</h3>
            <p className="text-sm opacity-70">
              Open balances ranked for follow-up. Add an outreach note after each contact.
            </p>
          </div>
          <div className="join">
            {(
              [
                ["all", "All"],
                ["overdue", "Overdue"],
                ["disputed", "Disputed"],
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
          <p className="text-sm opacity-70">No invoices in this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Balance</th>
                  <th>Days</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const status = collectionStatus(item);
                  return (
                    <tr
                      key={item.invoiceId}
                      id={`focus-${item.invoiceNumber}`}
                      data-focus={item.invoiceNumber}
                      className="hover align-top transition"
                    >
                      <td className="font-medium">{item.customerName}</td>
                      <td>
                        <span className="font-medium">{item.invoiceNumber}</span>
                        <div className="text-xs opacity-60">
                          {formatStatusLabel(item.status)}
                        </div>
                      </td>
                      <td>{money(item.balance)}</td>
                      <td
                        className={
                          item.daysOutstanding > 60
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
                        <span className={`badge badge-sm ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="max-w-[12rem] text-xs">
                        {item.lastNote ? (
                          <>
                            <p className="line-clamp-2">{item.lastNote}</p>
                            <p className="opacity-50">
                              {item.lastNoteAt ? item.lastNoteAt.slice(0, 10) : ""}
                            </p>
                          </>
                        ) : (
                          <span className="opacity-50">—</span>
                        )}
                      </td>
                      <td className="space-y-2">
                        <Link
                          href={`/invoices/${item.invoiceId}`}
                          className="btn btn-ghost btn-xs"
                        >
                          View invoice
                        </Link>
                        <Link
                          href={`/payments?invoice_id=${item.invoiceId}`}
                          className="btn btn-ghost btn-xs"
                        >
                          Record payment
                        </Link>
                        {item.disputeStatus !== "open" && item.balance > 0 ? (
                          <form action={writeOffInvoice} className="flex flex-col gap-1">
                            <input type="hidden" name="invoice_id" value={item.invoiceId} />
                            <input
                              name="note"
                              required
                              minLength={3}
                              placeholder="Write-off reason…"
                              className="input input-bordered input-xs w-40"
                            />
                            <button className="btn btn-error btn-outline btn-xs">
                              Write off
                            </button>
                          </form>
                        ) : null}
                        <form action={addCollectionNote} className="flex flex-col gap-1">
                          <input type="hidden" name="invoice_id" value={item.invoiceId} />
                          <input
                            name="note"
                            required
                            minLength={3}
                            placeholder="Collection note…"
                            className="input input-bordered input-xs w-40"
                          />
                          <button className="btn btn-outline btn-xs">Save note</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
