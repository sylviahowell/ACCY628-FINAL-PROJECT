/** RowanLane demo chart of accounts — freight brokerage (non-asset carrier model). */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "cogs"
  | "expense";

export type ChartAccount = {
  number: string;
  name: string;
  type: AccountType;
  /** How this account shows up in RowanLane’s C2C flow. */
  use: string;
  /** Matches journal line labels in accounting-entries when posted in-demo. */
  journalLabel?: string;
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "Cost of services",
  expense: "Operating expenses",
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cogs",
  "expense",
];

/**
 * Lean COA for a mid-sized freight broker: arrange capacity, bill shippers,
 * pay carriers. No inventory / owned-fleet accounts.
 */
export const ROWANLANE_CHART_OF_ACCOUNTS: ChartAccount[] = [
  {
    number: "1000",
    name: "Cash",
    type: "asset",
    use: "Customer collections and carrier remittances (simulated ACH/wire).",
    journalLabel: "Cash",
  },
  {
    number: "1100",
    name: "Accounts receivable",
    type: "asset",
    use: "Open customer invoices after billing; cleared when cash is applied.",
    journalLabel: "Accounts receivable",
  },
  {
    number: "1200",
    name: "Contract asset (unbilled earned)",
    type: "asset",
    use: "ASC 606 — revenue earned at POD before the customer invoice is issued.",
    journalLabel: "Contract asset (unbilled earned)",
  },
  {
    number: "2000",
    name: "Accounts payable",
    type: "liability",
    use: "Carrier bills on the books awaiting remittance.",
    journalLabel: "Accounts payable",
  },
  {
    number: "2100",
    name: "Accrued carrier payable",
    type: "liability",
    use: "Estimated buy cost / accessorials accrued at delivery before a carrier bill exists.",
    journalLabel: "Accrued carrier payable",
  },
  {
    number: "3000",
    name: "Retained earnings",
    type: "equity",
    use: "Cumulative brokerage margin (demo equity roll-forward; not auto-posted).",
  },
  {
    number: "4000",
    name: "Brokerage revenue",
    type: "revenue",
    use: "Sell-side freight revenue when the load is delivered with POD (customer rate − approved discount).",
    journalLabel: "Brokerage revenue",
  },
  {
    number: "4100",
    name: "Accessorial revenue",
    type: "revenue",
    use: "Billable detention, layover, and other shipper-facing extras once approved.",
  },
  {
    number: "4200",
    name: "Fuel surcharge revenue",
    type: "revenue",
    use: "Contract fuel surcharge passed through on the customer invoice.",
  },
  {
    number: "5000",
    name: "Purchased transportation",
    type: "cogs",
    use: "Primary COGS — carrier buy rate on each load (recognized with delivery).",
    journalLabel: "Purchased transportation (COGS)",
  },
  {
    number: "5100",
    name: "Carrier accessorial expense",
    type: "cogs",
    use: "Detention and other payables owed to the carrier (approved accessorials).",
  },
  {
    number: "5200",
    name: "Claims & recovery expense",
    type: "cogs",
    use: "Loss / damage / service-failure costs when the broker absorbs a claim.",
  },
  {
    number: "6000",
    name: "Bad debt expense",
    type: "expense",
    use: "Write-offs when collections fail on past-due customer AR (manual / control story).",
    journalLabel: "Bad debt expense",
  },
  {
    number: "6100",
    name: "Broker commissions & bonuses",
    type: "expense",
    use: "Sales / ops incentive pay tied to booked margin (outside load COGS).",
  },
  {
    number: "6200",
    name: "Insurance & bonding",
    type: "expense",
    use: "Contingent cargo / broker liability coverage and related premiums.",
  },
  {
    number: "6300",
    name: "Software & technology",
    type: "expense",
    use: "TMS / C2C platform, EDI, and demo-stack hosting costs.",
  },
  {
    number: "6400",
    name: "General & administrative",
    type: "expense",
    use: "Office, legal, and corporate overhead not allocated to a single load.",
  },
];

export type AccountActivity = {
  number: string;
  debit: number;
  credit: number;
};

/** Roll demo journal lines into COA activity by journalLabel. */
export function rollupAccountActivity(
  lines: { account: string; debit: number; credit: number }[],
): Map<string, AccountActivity> {
  const byLabel = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const cur = byLabel.get(line.account) ?? { debit: 0, credit: 0 };
    cur.debit += line.debit;
    cur.credit += line.credit;
    byLabel.set(line.account, cur);
  }

  const out = new Map<string, AccountActivity>();
  for (const acct of ROWANLANE_CHART_OF_ACCOUNTS) {
    if (!acct.journalLabel) continue;
    const hit = byLabel.get(acct.journalLabel);
    if (!hit) continue;
    out.set(acct.number, {
      number: acct.number,
      debit: hit.debit,
      credit: hit.credit,
    });
  }
  return out;
}
