import Link from "next/link";
import { ExportTrialBalanceButton } from "@/components/ExportTrialBalanceButton";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  ROWANLANE_CHART_OF_ACCOUNTS,
  type AccountActivity,
  type AccountType,
} from "@/lib/chart-of-accounts";
import { buildTrialBalance } from "@/lib/trial-balance";
import { money } from "@/lib/types";

function typeBadge(type: AccountType) {
  switch (type) {
    case "revenue":
      return "badge-success";
    case "cogs":
    case "expense":
      return "badge-warning";
    case "asset":
      return "badge-info";
    case "liability":
      return "badge-secondary";
    default:
      return "badge-ghost";
  }
}

export function ChartOfAccountsPanel({
  activity,
}: {
  activity: Map<string, AccountActivity>;
}) {
  const trialBalanceRows = buildTrialBalance(activity);

  return (
    <div id="chart-of-accounts" className="card bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-base">Chart of accounts</h2>
            <p className="text-sm opacity-70">
              RowanLane’s brokerage books — sell-side freight revenue, purchased transportation
              COGS, and working-capital accounts used in the C2C journals. Activity totals are
              rolled from demo entries on this page.
            </p>
          </div>
          <ExportTrialBalanceButton rows={trialBalanceRows} />
        </div>

        <div className="space-y-5">
          {ACCOUNT_TYPE_ORDER.map((type) => {
            const rows = ROWANLANE_CHART_OF_ACCOUNTS.filter((a) => a.type === type);
            if (!rows.length) return null;
            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`badge badge-sm ${typeBadge(type)}`}>
                    {ACCOUNT_TYPE_LABEL[type]}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th className="w-20">No.</th>
                        <th>Account</th>
                        <th>Use in RowanLane</th>
                        <th className="text-right">Demo debits</th>
                        <th className="text-right">Demo credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => {
                        const act = activity.get(a.number);
                        return (
                          <tr key={a.number}>
                            <td className="font-mono text-xs">{a.number}</td>
                            <td className="font-medium">
                              {a.name}
                              {a.journalLabel ? (
                                <span className="ml-2 badge badge-ghost badge-xs">
                                  in journals
                                </span>
                              ) : (
                                <span className="ml-2 badge badge-ghost badge-xs opacity-60">
                                  model only
                                </span>
                              )}
                            </td>
                            <td className="max-w-md text-xs opacity-80">{a.use}</td>
                            <td className="text-right tabular-nums text-sm">
                              {act?.debit ? money(act.debit) : "—"}
                            </td>
                            <td className="text-right tabular-nums text-sm">
                              {act?.credit ? money(act.credit) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs opacity-60">
          Revenue and COGS drive load margin; G&A accounts exist for the brokerage entity but
          are not auto-allocated per shipment in this demo. Export downloads an Excel-compatible
          trial balance (account #, name, type, debit/credit) for billing review.{" "}
          <Link href="#accounting-entries" className="link link-primary">
            See accounting entries
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
