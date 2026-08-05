import Link from "next/link";
import type { CarrierTask } from "@/lib/portal-views";

function priorityBadge(p: CarrierTask["priority"]) {
  if (p === "high") return "badge-error";
  if (p === "medium") return "badge-warning";
  return "badge-ghost";
}

export function CarrierTaskList({ tasks }: { tasks: CarrierTask[] }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <h3 className="card-title text-base">My task list</h3>
        <p className="text-sm opacity-70">
          Pickups, deliveries, and document work for your assigned loads only.
        </p>
        {tasks.length === 0 ? (
          <p className="text-sm opacity-70">No open carrier tasks right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Load</th>
                  <th>Route</th>
                  <th>Deadline</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="hover">
                    <td>
                      <span className={`badge badge-sm ${priorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <Link href={t.href} className="link link-primary font-medium">
                        {t.loadNumber}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] truncate text-xs">{t.route}</td>
                    <td className="text-xs">{t.deadline ?? "—"}</td>
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
