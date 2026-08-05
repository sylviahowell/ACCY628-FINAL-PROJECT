import { createClient } from "@/lib/supabase/server";

/** Write a billing audit row into status_events (who / when / what). */
export async function logBillingEvent(input: {
  entityType: "invoice" | "payment" | "dispute";
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  note?: string;
}) {
  const supabase = await createClient();
  await supabase.from("status_events").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    changed_by: input.changedBy,
    note: input.note ?? null,
  });
}
