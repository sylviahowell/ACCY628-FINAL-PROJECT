import Link from "next/link";
import type { BillingInsight, UnbilledItem } from "@/lib/collections";

export function BillingInsightsPanel({ insights }: { insights: BillingInsight[] }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">Billing insights</h3>
        <p className="text-sm opacity-70">
          Rule-based collections observations — not artificial intelligence.
        </p>
        <ul className="mt-2 space-y-3">
          {insights.map((ins) => (
            <li key={ins.id} className="rounded-box border border-base-300 p-3">
              <p className="font-medium text-sm">{ins.observation}</p>
              <p className="mt-1 text-xs opacity-70">{ins.whyItMatters}</p>
              <p className="mt-2 text-sm">
                {ins.action}{" "}
                <Link href={ins.href} className="link link-primary">
                  Open
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function UnbilledQueuePanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: UnbilledItem[];
  empty: string;
}) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">
          {title}{" "}
          <span className="badge badge-ghost badge-sm">{items.length}</span>
        </h3>
        {items.length === 0 ? (
          <p className="text-sm opacity-70">{empty}</p>
        ) : (
          <ul className="divide-y divide-base-200">
            {items.map((item) => (
              <li
                key={item.shipmentId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <Link
                    href={`/shipments/${item.shipmentId}`}
                    className="link link-primary font-medium"
                  >
                    {item.loadNumber}
                  </Link>
                  <p className="text-xs opacity-70">
                    {item.customerName}
                    {item.deliveryDate ? ` · delivered ${item.deliveryDate}` : ""}
                  </p>
                  <p className="text-sm">{item.reason}</p>
                </div>
                <Link href={item.href} className="btn btn-outline btn-xs">
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
