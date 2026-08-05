import Link from "next/link";
import {
  ENTRY_TYPE_LABEL,
  entryTotals,
  formatEntryMoney,
  type AccountingEntry,
  type AccountingEntryType,
} from "@/lib/accounting-entries";

const FILTERS: { key: "all" | AccountingEntryType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recognize", label: "Recognize" },
  { key: "bill", label: "Bill" },
  { key: "collect", label: "Collect" },
  { key: "write_off", label: "Write-off" },
  { key: "accrue_ap", label: "Carrier bill" },
  { key: "pay_carrier", label: "Pay carrier" },
];

export function AccountingEntriesPanel({
  entries,
  activeFilter = "all",
}: {
  entries: AccountingEntry[];
  activeFilter?: "all" | AccountingEntryType;
}) {
  const filtered =
    activeFilter === "all"
      ? entries
      : entries.filter((e) => e.type === activeFilter);

  return (
    <div id="accounting-entries" className="card bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-base">Accounting entries</h2>
            <p className="text-sm opacity-70">
              Balanced demo journal lines derived from POD, invoices, customer cash, and
              carrier AP — not a separate posted ledger.
            </p>
          </div>
          <span className="badge badge-ghost badge-sm">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const href =
              f.key === "all" ? "/accounting#accounting-entries" : `/accounting?entries=${f.key}#accounting-entries`;
            const active = activeFilter === f.key;
            return (
              <Link
                key={f.key}
                href={href}
                className={`btn btn-xs ${active ? "btn-primary" : "btn-ghost"}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <div className="space-y-3">
          {filtered.slice(0, 40).map((entry) => {
            const { debit, credit, balanced } = entryTotals(entry);
            return (
              <div
                key={entry.id}
                className="rounded-box border border-base-300 bg-base-200/40 p-3"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="badge badge-outline badge-sm mr-2">
                      {ENTRY_TYPE_LABEL[entry.type]}
                    </span>
                    <span className="text-sm font-medium">{entry.memo}</span>
                  </div>
                  <div className="text-xs opacity-70">
                    {entry.date}
                    {entry.refHref ? (
                      <>
                        {" · "}
                        <Link href={entry.refHref} className="link link-primary">
                          {entry.refLabel}
                        </Link>
                      </>
                    ) : null}
                    {!balanced ? (
                      <span className="ml-2 text-error">unbalanced</span>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th className="text-right">Debit</th>
                        <th className="text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line, idx) => (
                        <tr key={`${entry.id}-${idx}`}>
                          <td className={line.credit > 0 ? "pl-6 opacity-90" : ""}>
                            {line.credit > 0 ? `Cr ${line.account}` : `Dr ${line.account}`}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatEntryMoney(line.debit)}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatEntryMoney(line.credit)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-medium opacity-80">
                        <td>Totals</td>
                        <td className="text-right tabular-nums">{formatEntryMoney(debit)}</td>
                        <td className="text-right tabular-nums">{formatEntryMoney(credit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <p className="text-sm opacity-60">No entries for this filter yet.</p>
          ) : null}
          {filtered.length > 40 ? (
            <p className="text-xs opacity-60">Showing latest 40 of {filtered.length}.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
