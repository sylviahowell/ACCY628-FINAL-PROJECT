"use client";

import {
  trialBalanceFileName,
  trialBalanceToSpreadsheetMl,
  trialBalanceTotals,
  type TrialBalanceRow,
} from "@/lib/trial-balance";
import { money } from "@/lib/types";

export function ExportTrialBalanceButton({ rows }: { rows: TrialBalanceRow[] }) {
  const totals = trialBalanceTotals(rows);
  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;

  function onExport() {
    const asOf = new Date().toISOString().slice(0, 10);
    const xml = trialBalanceToSpreadsheetMl(rows, asOf);
    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = trialBalanceFileName(asOf);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-primary btn-sm" onClick={onExport}>
        Export trial balance (Excel)
      </button>
      <p className="text-xs opacity-70">
        Debits {money(totals.debit)} · Credits {money(totals.credit)}
        {balanced ? " · in balance" : " · review imbalance"}
      </p>
    </div>
  );
}
