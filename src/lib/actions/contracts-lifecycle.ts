"use server";

import { createClient } from "@/lib/supabase/server";

/** Mark active contracts past end_date as expired (called at booking touchpoints). */
export async function expirePastEndContracts() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("contracts")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("end_date", today);
}
