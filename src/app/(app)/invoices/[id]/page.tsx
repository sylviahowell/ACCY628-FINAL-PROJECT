import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintInvoiceButton } from "@/components/PrintInvoiceButton";
import { requirePathAccess } from "@/lib/authz";
import { writeOffInvoice } from "@/lib/actions/freight";
import { normalizePodUrl, sanitizeDemoText } from "@/lib/display-text";
import { isDepositInvoice } from "@/lib/invoice-helpers";
import { canManageBilling } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, statusBadge } from "@/lib/types";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requirePathAccess("/invoices");
  if (profile.role === "carrier" || profile.role === "broker") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "*, customers(name, billing_address, payment_terms, contact_email), shipments(id, load_number, pickup_location, delivery_location, customer_rate, discount_amount, discount_approved, delivery_date)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  if (
    profile.role === "customer" &&
    profile.customer_id &&
    inv.customer_id !== profile.customer_id
  ) {
    notFound();
  }

  const shipment = (Array.isArray(inv.shipments) ? inv.shipments[0] : inv.shipments) as {
    id?: string;
    load_number?: string;
    pickup_location?: string | null;
    delivery_location?: string | null;
    customer_rate?: number;
    discount_amount?: number | null;
    discount_approved?: boolean | null;
    delivery_date?: string | null;
  } | null;
  const customer = (Array.isArray(inv.customers) ? inv.customers[0] : inv.customers) as {
    name?: string;
    billing_address?: string | null;
    payment_terms?: string | null;
    contact_email?: string | null;
  } | null;

  const shipmentId = shipment?.id ?? inv.shipment_id;
  const { data: charges } = shipmentId
    ? await supabase
        .from("shipment_charges")
        .select("description, amount, billable_to_customer, approval_status, charge_type")
        .eq("shipment_id", shipmentId)
    : { data: [] as never[] };
  const { data: pods } = shipmentId
    ? await supabase
        .from("proof_of_delivery")
        .select("signed_by, delivered_at, file_url, notes")
        .eq("shipment_id", shipmentId)
        .order("delivered_at", { ascending: false })
        .limit(1)
    : { data: [] as never[] };
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, payment_date, method, reference")
    .eq("invoice_id", id)
    .order("payment_date", { ascending: false });

  const billableCharges = (charges ?? []).filter(
    (c) => c.billable_to_customer && c.approval_status === "approved",
  );
  const rate = Number(shipment?.customer_rate ?? inv.subtotal ?? inv.total);
  const discount =
    shipment?.discount_approved ? Number(shipment.discount_amount ?? 0) : 0;
  const extras = billableCharges.reduce((s, c) => s + Number(c.amount), 0);
  const balance = Math.max(0, Number(inv.total) - Number(inv.amount_paid));
  const pod = pods?.[0];
  const podUrl = normalizePodUrl(pod?.file_url);
  const canWriteOff =
    canManageBilling(profile.role) &&
    balance > 0 &&
    !["paid", "cancelled", "disputed"].includes(inv.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/invoices" className="link link-primary text-sm">
            ← Invoices
          </Link>
          <h1 className="text-2xl font-bold">{inv.invoice_number}</h1>
          <p className="text-sm opacity-70">
            Printable customer invoice for contract-to-cash review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintInvoiceButton />
          {shipmentId ? (
            <Link href={`/shipments/${shipmentId}`} className="btn btn-ghost btn-sm">
              Open shipment
            </Link>
          ) : null}
          {canManageBilling(profile.role) && balance > 0 && inv.status !== "disputed" ? (
            <Link
              href={`/payments?invoice_id=${inv.id}`}
              className="btn btn-ghost btn-sm"
            >
              Record payment
            </Link>
          ) : null}
        </div>
      </div>

      <div
        id="print-root"
        className="card bg-base-100 shadow-sm print:shadow-none print:border-0"
      >
        <div className="card-body gap-6">
          <div className="flex flex-wrap justify-between gap-4 border-b border-base-300 pb-4">
            <div>
              <p className="font-brand text-xl font-bold">RowanLane</p>
              <p className="text-sm opacity-70">Freight brokerage invoice</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{inv.invoice_number}</p>
              <p>
                Status{" "}
                <span className={`badge badge-sm ${statusBadge(inv.status)}`}>{inv.status}</span>
                {isDepositInvoice(inv) ? (
                  <span className="badge badge-info badge-sm ml-1">downpayment</span>
                ) : null}
              </p>
              <p>Issued {inv.issue_date}</p>
              <p>Due {inv.due_date}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="font-semibold">Bill to</p>
              <p>{customer?.name ?? "—"}</p>
              {customer?.billing_address ? (
                <p className="opacity-70 whitespace-pre-line">{customer.billing_address}</p>
              ) : null}
              {customer?.contact_email ? (
                <p className="opacity-70">{customer.contact_email}</p>
              ) : null}
              <p className="opacity-70">
                Terms {customer?.payment_terms ?? "per contract"}
              </p>
            </div>
            <div>
              <p className="font-semibold">Shipment</p>
              <p>{shipment?.load_number ?? "—"}</p>
              {shipment?.pickup_location ? (
                <p className="opacity-70">From {shipment.pickup_location}</p>
              ) : null}
              {shipment?.delivery_location ? (
                <p className="opacity-70">To {shipment.delivery_location}</p>
              ) : null}
              {shipment?.delivery_date ? (
                <p className="opacity-70">Delivered {shipment.delivery_date}</p>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Brokerage / freight (sell rate)</td>
                  <td className="text-right tabular-nums">{money(rate)}</td>
                </tr>
                {discount > 0 ? (
                  <tr>
                    <td>Approved discount</td>
                    <td className="text-right tabular-nums text-error">
                      −{money(discount)}
                    </td>
                  </tr>
                ) : null}
                {billableCharges.map((c, idx) => (
                  <tr key={`${c.description}-${idx}`}>
                    <td>
                      {c.description}
                      {c.charge_type ? (
                        <span className="opacity-60"> · {c.charge_type}</span>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{money(c.amount)}</td>
                  </tr>
                ))}
                {extras === 0 && Number(inv.total) !== rate - discount ? (
                  <tr>
                    <td>Other billable adjustments (fuel / deposit)</td>
                    <td className="text-right tabular-nums">
                      {money(Number(inv.total) - (rate - discount))}
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td>Invoice total</td>
                  <td className="text-right tabular-nums">{money(inv.total)}</td>
                </tr>
                <tr>
                  <td>Amount paid</td>
                  <td className="text-right tabular-nums">{money(inv.amount_paid)}</td>
                </tr>
                <tr className="font-semibold">
                  <td>Balance due</td>
                  <td className="text-right tabular-nums">{money(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {pod ? (
            <div className="rounded-box bg-base-200/60 p-3 text-sm">
              <p className="font-medium">Proof of delivery</p>
              <p className="opacity-70">
                Signed by {pod.signed_by ?? "—"} ·{" "}
                {new Date(pod.delivered_at).toLocaleString()}
              </p>
              {sanitizeDemoText(pod.notes) ? (
                <p className="opacity-60">{sanitizeDemoText(pod.notes)}</p>
              ) : null}
              {podUrl ? (
                <a href={podUrl} className="link link-primary" target="_blank" rel="noreferrer">
                  Open delivery document
                </a>
              ) : null}
            </div>
          ) : null}

          {(payments ?? []).length > 0 ? (
            <div className="text-sm">
              <p className="font-medium mb-1">Payments / applications</p>
              <ul className="space-y-1">
                {(payments ?? []).map((p, idx) => (
                  <li key={`${p.payment_date}-${idx}`} className="flex justify-between gap-3">
                    <span>
                      {p.payment_date} ·{" "}
                      {(p.method ?? "").includes("write_off")
                        ? "Write-off (bad debt)"
                        : (p.method ?? "payment").replace(/_simulated$/i, "")}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {canWriteOff ? (
        <div className="card border border-error/30 bg-error/5 shadow-sm print:hidden">
          <div className="card-body py-4">
            <h2 className="card-title text-base">Write off remaining balance</h2>
            <p className="text-sm opacity-70">
              Posts Dr Bad debt expense / Cr Accounts receivable for {money(balance)} (demo
              journal). Use for uncollectible AR after collections effort.
            </p>
            <form action={writeOffInvoice} className="flex flex-wrap gap-2">
              <input type="hidden" name="invoice_id" value={inv.id} />
              <input
                name="note"
                required
                minLength={3}
                placeholder="Write-off reason"
                className="input input-bordered input-sm grow"
              />
              <button className="btn btn-error btn-sm">Write off {money(balance)}</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
