import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/types";

export type NetworkSnapshot = {
  active_shipments: number;
  in_transit: number;
  delivered_today: number;
  delayed_shipments: number;
  open_invoice_balance: number;
  avg_gross_margin_pct: number;
  as_of: string;
};

export async function getDemoNetworkSnapshot(): Promise<NetworkSnapshot | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("demo_network_snapshot");
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      active_shipments: Number(row.active_shipments ?? 0),
      in_transit: Number(row.in_transit ?? 0),
      delivered_today: Number(row.delivered_today ?? 0),
      delayed_shipments: Number(row.delayed_shipments ?? 0),
      open_invoice_balance: Number(row.open_invoice_balance ?? 0),
      avg_gross_margin_pct: Number(row.avg_gross_margin_pct ?? 0),
      as_of: String(row.as_of ?? ""),
    };
  } catch {
    return null;
  }
}

export function formatSnapshotMoney(n: number) {
  return money(n);
}
