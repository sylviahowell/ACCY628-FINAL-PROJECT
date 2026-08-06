"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterBrokerTasks,
  type BrokerFilter,
  type BrokerTask,
} from "@/lib/broker-tasks";
import { formatStatusLabel, statusBadge } from "@/lib/types";

const FILTERS: { id: BrokerFilter; label: string }[] = [
  { id: "all", label: "All tasks" },
  { id: "my_loads", label: "My loads" },
  { id: "due_today", label: "Due today" },
  { id: "delayed", label: "Delayed" },
  { id: "unassigned", label: "Unassigned" },
  { id: "high_priority", label: "High priority" },
];

function priorityBadge(p: BrokerTask["priority"]) {
  if (p === "high") return "badge-error";
  if (p === "medium") return "badge-warning";
  return "badge-ghost";
}

export function BrokerTaskBoard({
  tasks,
  profileId,
  today,
}: {
  tasks: BrokerTask[];
  profileId: string;
  today: string;
}) {
  const [filter, setFilter] = useState<BrokerFilter>("all");
  const visible = useMemo(() => {
    if (filter === "due_today") {
      return tasks.filter(
        (t) =>
          t.category === "pickup_today" ||
          t.category === "delivery_today" ||
          t.deadline === today,
      );
    }
    return filterBrokerTasks(tasks, filter, profileId);
  }, [tasks, filter, profileId, today]);

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Work queue</h3>
            <p className="text-sm opacity-70">
              Actionable freight tasks ranked by priority. Margins shown only on the shipment when
              you open a load.
            </p>
          </div>
          <div className="join flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-xs join-item ${filter === f.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm opacity-70">No tasks in this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Shipment</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="hover">
                    <td>
                      <span className={`badge badge-sm ${priorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      {t.shipmentId ? (
                        <Link href={t.href} className="link link-primary font-medium">
                          {t.loadNumber}
                        </Link>
                      ) : (
                        <Link href={t.href} className="link link-primary font-medium">
                          {t.loadNumber}
                        </Link>
                      )}
                    </td>
                    <td>{t.customer}</td>
                    <td className="max-w-[14rem] truncate text-xs">{t.route}</td>
                    <td className="text-xs">{t.deadline ?? "—"}</td>
                    <td>
                      <span className={`badge badge-sm ${statusBadge(t.status)}`}>
                        {formatStatusLabel(t.status)}
                      </span>
                    </td>
                    <td className="text-sm">{t.action}</td>
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
