import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  ROWANLANE_CHART_OF_ACCOUNTS,
  type AccountActivity,
  type AccountType,
} from "@/lib/chart-of-accounts";

export type TrialBalanceRow = {
  number: string;
  name: string;
  type: AccountType;
  typeLabel: string;
  /** Period activity debit from demo journals */
  activityDebit: number;
  /** Period activity credit from demo journals */
  activityCredit: number;
  /** Classic trial-balance debit column (net debit balance) */
  debit: number;
  /** Classic trial-balance credit column (net credit balance) */
  credit: number;
};

/** Build a demo trial balance from COA + rolled journal activity. */
export function buildTrialBalance(
  activity: Map<string, AccountActivity>,
): TrialBalanceRow[] {
  const rows: TrialBalanceRow[] = [];
  for (const type of ACCOUNT_TYPE_ORDER) {
    for (const acct of ROWANLANE_CHART_OF_ACCOUNTS.filter((a) => a.type === type)) {
      const act = activity.get(acct.number);
      const activityDebit = act?.debit ?? 0;
      const activityCredit = act?.credit ?? 0;
      const net = activityDebit - activityCredit;
      rows.push({
        number: acct.number,
        name: acct.name,
        type: acct.type,
        typeLabel: ACCOUNT_TYPE_LABEL[acct.type],
        activityDebit,
        activityCredit,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
      });
    }
  }
  return rows;
}

export function trialBalanceTotals(rows: TrialBalanceRow[]) {
  return rows.reduce(
    (acc, r) => {
      acc.debit += r.debit;
      acc.credit += r.credit;
      acc.activityDebit += r.activityDebit;
      acc.activityCredit += r.activityCredit;
      return acc;
    },
    { debit: 0, credit: 0, activityDebit: 0, activityCredit: 0 },
  );
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value: string | number, type: "String" | "Number" = "String") {
  if (type === "Number") {
    const n = typeof value === "number" ? value : Number(value);
    return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

/** Excel-compatible SpreadsheetML (.xls) — opens in Excel / Google Sheets. */
export function trialBalanceToSpreadsheetMl(
  rows: TrialBalanceRow[],
  asOf: string,
): string {
  const totals = trialBalanceTotals(rows);
  const header = [
    "Account #",
    "Account name",
    "Type",
    "Debit",
    "Credit",
    "Activity debit",
    "Activity credit",
  ];
  const bodyRows = rows.map(
    (r) =>
      `<Row>${cell(r.number)}${cell(r.name)}${cell(r.typeLabel)}${cell(r.debit, "Number")}${cell(r.credit, "Number")}${cell(r.activityDebit, "Number")}${cell(r.activityCredit, "Number")}</Row>`,
  );
  const totalRow = `<Row>${cell("TOTAL")}${cell("")}${cell("")}${cell(totals.debit, "Number")}${cell(totals.credit, "Number")}${cell(totals.activityDebit, "Number")}${cell(totals.activityCredit, "Number")}</Row>`;
  const meta = `<Row>${cell(`RowanLane trial balance as of ${asOf}`)}</Row><Row></Row>`;

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Trial Balance">
  <Table>
   ${meta}
   <Row>${header.map((h) => cell(h)).join("")}</Row>
   ${bodyRows.join("\n   ")}
   ${totalRow}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function trialBalanceFileName(asOf: string) {
  return `rowanlane-trial-balance-${asOf}.xls`;
}
