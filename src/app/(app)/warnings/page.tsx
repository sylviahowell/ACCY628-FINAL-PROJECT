import { requirePathAccess } from "@/lib/authz";
import { buildAlerts, filterAlertsForProfile } from "@/lib/alerts";
import { WarningsTriage } from "@/components/WarningsTriage";
import { createClient } from "@/lib/supabase/server";
import { isInternalStaff } from "@/lib/roles";

export default async function WarningsPage() {
  const profile = await requirePathAccess("/warnings");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: shipments },
    { data: invoices },
    { data: carriers },
    { data: contracts },
    { data: charges },
    { data: pods },
    { data: disputes },
    { data: approvals },
    { data: coverageRequests },
    { data: supportTickets },
  ] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, load_number, status, carrier_id, customer_id, promised_delivery_date, delivery_date, customer_rate, carrier_cost, customers(name)",
      ),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, shipment_id, customer_id, status, total, amount_paid, due_date, customers(name)",
      ),
    isInternalStaff(profile.role)
      ? supabase.from("carriers").select("id, name, insurance_expiration")
      : Promise.resolve({ data: [] as { id: string; name: string; insurance_expiration: string | null }[] }),
    isInternalStaff(profile.role)
      ? supabase
          .from("contracts")
          .select("id, contract_number, end_date, status, customer_id")
      : Promise.resolve({
          data: [] as {
            id: string;
            contract_number: string;
            end_date: string | null;
            status: string;
            customer_id: string;
          }[],
        }),
    isInternalStaff(profile.role)
      ? supabase
          .from("shipment_charges")
          .select("id, shipment_id, approval_status, description, amount")
          .eq("approval_status", "pending")
      : Promise.resolve({
          data: [] as {
            id: string;
            shipment_id: string;
            approval_status: string;
            description: string;
            amount: number;
          }[],
        }),
    supabase.from("proof_of_delivery").select("shipment_id"),
    supabase
      .from("disputes")
      .select("id, status, invoice_id, reason, amount_disputed, customer_id")
      .eq("status", "open"),
    profile.role === "manager"
      ? supabase
          .from("approval_requests")
          .select("id, status, request_type, amount, reason")
          .eq("status", "pending")
      : Promise.resolve({
          data: [] as {
            id: string;
            status: string;
            request_type: string;
            amount: number;
            reason: string | null;
          }[],
        }),
    profile.role === "manager" || profile.role === "broker"
      ? supabase
          .from("coverage_requests")
          .select("id, pickup_location, delivery_location, customers(name)")
          .eq("status", "pending")
          .limit(30)
      : Promise.resolve({
          data: [] as {
            id: string;
            pickup_location: string;
            delivery_location: string;
            customers?: { name?: string } | null;
          }[],
        }),
    supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, status, priority, customer_id, carrier_id")
      .in("status", ["open", "pending"])
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  let shipRows = shipments ?? [];
  let invRows = invoices ?? [];
  let disputeRows = disputes ?? [];
  let podRows = pods ?? [];
  let chargeRows = charges ?? [];
  let supportRows = supportTickets ?? [];

  if (profile.role === "customer" && profile.customer_id) {
    const cid = profile.customer_id;
    shipRows = shipRows.filter((s) => s.customer_id === cid);
    invRows = invRows.filter((i) => i.customer_id === cid);
    disputeRows = disputeRows.filter((d) => d.customer_id === cid);
    const ids = new Set(shipRows.map((s) => s.id));
    podRows = podRows.filter((p) => ids.has(p.shipment_id));
    supportRows = supportRows.filter((t) => t.customer_id === cid);
  } else if (profile.role === "carrier" && profile.carrier_id) {
    const carId = profile.carrier_id;
    shipRows = shipRows.filter((s) => s.carrier_id === carId);
    const ids = new Set(shipRows.map((s) => s.id));
    podRows = podRows.filter((p) => ids.has(p.shipment_id));
    chargeRows = chargeRows.filter((c) => ids.has(c.shipment_id));
    supportRows = supportRows.filter((t) => t.carrier_id === carId);
  }

  const all = buildAlerts({
    shipments: shipRows,
    invoices: invRows,
    carriers: carriers ?? [],
    contracts: contracts ?? [],
    charges: chargeRows,
    pods: podRows,
    disputes: disputeRows,
    approvals: approvals ?? [],
    coverageRequests: coverageRequests ?? [],
    supportTickets: supportRows,
    today,
  });
  const alerts = filterAlertsForProfile(all, profile);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warning Center</h1>
        <p className="text-sm opacity-70">
          Live exceptions for your role — critical first. Use filters to triage, then Resolve.
        </p>
      </div>

      <WarningsTriage alerts={alerts} />
    </div>
  );
}
