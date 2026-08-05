"use server";

import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageBilling, canManageOperations } from "@/lib/roles";

export type SearchHit = {
  type: "shipment" | "invoice" | "customer" | "carrier" | "contract";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const q = query.trim().replace(/[%_,]/g, " ").slice(0, 80);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  let shipmentQuery = supabase
    .from("shipments")
    .select("id, load_number, status, pickup_location, delivery_location, customer_id, carrier_id")
    .or(
      `load_number.ilike.${like},pickup_location.ilike.${like},delivery_location.ilike.${like}`,
    )
    .limit(8);

  if (profile.role === "customer" && profile.customer_id) {
    shipmentQuery = shipmentQuery.eq("customer_id", profile.customer_id);
  } else if (profile.role === "carrier" && profile.carrier_id) {
    shipmentQuery = shipmentQuery.eq("carrier_id", profile.carrier_id);
  }

  const { data: shipments } = await shipmentQuery;

  for (const s of shipments ?? []) {
    hits.push({
      type: "shipment",
      id: s.id,
      title: s.load_number,
      subtitle: `${s.status} · ${s.pickup_location} → ${s.delivery_location}`,
      href: `/shipments/${s.id}`,
    });
  }

  if (canManageBilling(profile.role) || profile.role === "customer") {
    let invoiceQuery = supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, customer_id, shipment_id")
      .ilike("invoice_number", like)
      .limit(6);
    if (profile.role === "customer" && profile.customer_id) {
      invoiceQuery = invoiceQuery.eq("customer_id", profile.customer_id);
    }
    const { data: invoices } = await invoiceQuery;
    for (const inv of invoices ?? []) {
      const bal = Number(inv.total) - Number(inv.amount_paid);
      hits.push({
        type: "invoice",
        id: inv.id,
        title: inv.invoice_number,
        subtitle:
          profile.role === "customer"
            ? `${inv.status} · balance ${bal}`
            : `${inv.status} · ${inv.total}`,
        href:
          (inv as { shipment_id?: string | null }).shipment_id
            ? `/shipments/${(inv as { shipment_id?: string }).shipment_id}`
            : "/invoices",
      });
    }
  }

  if (canManageOperations(profile.role)) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, contact_email")
      .ilike("name", like)
      .limit(5);
    for (const c of customers ?? []) {
      hits.push({
        type: "customer",
        id: c.id,
        title: c.name,
        subtitle: c.contact_email ?? "Customer",
        href: "/customers",
      });
    }

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, contract_number, title, status")
      .or(`contract_number.ilike.${like},title.ilike.${like}`)
      .limit(5);
    for (const c of contracts ?? []) {
      hits.push({
        type: "contract",
        id: c.id,
        title: c.contract_number,
        subtitle: `${c.title ?? ""} · ${c.status}`,
        href: "/contracts",
      });
    }
  }

  if (canManageOperations(profile.role)) {
    const { data: carriers } = await supabase
      .from("carriers")
      .select("id, name, mc_number")
      .or(`name.ilike.${like},mc_number.ilike.${like}`)
      .limit(5);
    for (const c of carriers ?? []) {
      hits.push({
        type: "carrier",
        id: c.id,
        title: c.name,
        subtitle: c.mc_number ?? "Carrier",
        href: "/carriers",
      });
    }
  }

  return hits.slice(0, 20);
}
