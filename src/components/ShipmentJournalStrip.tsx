import Link from "next/link";
import {
  ENTRY_TYPE_LABEL,
  entryTotals,
  formatEntryMoney,
  type AccountingEntry,
} from "@/lib/accounting-entries";

/** Compact per-load journal strip for shipment detail. */
export function ShipmentJournalStrip({
  entries,
  accountingHref = "/accounting#accounting-entries",
}: {
  entries: AccountingEntry[];
  accountingHref?: string;
}) {
  if (!entries.length) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body py-4">
          <h2 className="card-title text-base">Accounting entries for this load</h2>
          <p className="text-sm opacity-70">
            Journal lines appear after POD recognition, invoicing, cash, or AP activity on this
            shipment.
          </p>
          <Link href={accountingHref} className="link link-primary text-sm w-fit">
            Open full accounting entries →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="load-journals" className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="card-title text-base">Accounting entries for this load</h2>
            <p className="text-sm opacity-70">
              ASC 606 path for this shipment — recognize → bill → collect / AP.
            </p>
          </div>
          <Link href={accountingHref} className="btn btn-ghost btn-xs">
            Full ledger →
          </Link>
        </div>
        <div className="space-y-2">
          {entries.map((entry) => {
            const { debit, credit } = entryTotals(entry);
            return (
              <div
                key={entry.id}
                className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2 text-sm"
              >
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="badge badge-outline badge-xs mr-2">
                      {ENTRY_TYPE_LABEL[entry.type]}
                    </span>
                    {entry.memo}
                  </span>
                  <span className="text-xs opacity-60">{entry.date}</span>
                </div>
                <ul className="space-y-0.5 text-xs">
                  {entry.lines.map((line, idx) => (
                    <li key={`${entry.id}-${idx}`} className="flex justify-between gap-4">
                      <span className={line.credit > 0 ? "pl-3 opacity-80" : ""}>
                        {line.credit > 0 ? `Cr ${line.account}` : `Dr ${line.account}`}
                      </span>
                      <span className="tabular-nums">
                        {formatEntryMoney(line.debit > 0 ? line.debit : line.credit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs opacity-50">
                  Totals {formatEntryMoney(debit)} / {formatEntryMoney(credit)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
