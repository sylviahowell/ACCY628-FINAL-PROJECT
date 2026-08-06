import Link from "next/link";
import { ExpandableSection } from "@/components/ExpandableSection";
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

  const shown = filtered.slice(0, 40);

  return (
    <ExpandableSection
      id="accounting-entries"
      title="Accounting entries"
      description="Balanced demo journal lines derived from POD, invoices, customer cash, and carrier AP — not a separate posted ledger."
      badge={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}`}
      defaultOpen={activeFilter !== "all"}
    >
      <div className="flex flex-wrap gap-2 pb-1">
        {FILTERS.map((f) => {
          const href =
            f.key === "all"
              ? "/accounting#accounting-entries"
              : `/accounting?entries=${f.key}#accounting-entries`;
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

      <div className="space-y-2 pb-2">
        {shown.map((entry) => {
          const { debit, credit, balanced } = entryTotals(entry);
          return (
            <details
              key={entry.id}
              className="collapse collapse-arrow rounded-box border border-base-300 bg-base-200/40"
            >
              <summary className="collapse-title min-h-0 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pr-2">
                  <div className="min-w-0">
                    <span className="badge badge-outline badge-sm mr-2">
                      {ENTRY_TYPE_LABEL[entry.type]}
                    </span>
                    <span className="font-medium">{entry.memo}</span>
                  </div>
                  <div className="shrink-0 text-xs opacity-70">
                    {entry.date}
                    <span className="ml-2 tabular-nums font-medium opacity-90">
                      {formatEntryMoney(debit)}
                    </span>
                    {!balanced ? (
                      <span className="ml-2 text-error">unbalanced</span>
                    ) : null}
                  </div>
                </div>
              </summary>
              <div className="collapse-content">
                <div className="mb-2 text-xs opacity-70">
                  {entry.refHref ? (
                    <Link href={entry.refHref} className="link link-primary">
                      {entry.refLabel}
                    </Link>
                  ) : (
                    entry.refLabel
                  )}
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
            </details>
          );
        })}

        {filtered.length === 0 ? (
          <p className="text-sm opacity-60">No entries for this filter yet.</p>
        ) : null}
        {filtered.length > 40 ? (
          <p className="text-xs opacity-60">Showing latest 40 of {filtered.length}.</p>
        ) : null}
      </div>
    </ExpandableSection>
  );
}
