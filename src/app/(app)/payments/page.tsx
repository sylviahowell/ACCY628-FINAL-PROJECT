import { redirect } from "next/navigation";
import { resolveSearchParams } from "@/components/FilterBanner";
import { requirePathAccess } from "@/lib/authz";

/** Legacy route — customer cash lives on Accounts Receivable. */
export default async function PaymentsRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requirePathAccess("/payments");
  const params = await resolveSearchParams(searchParams);
  const q = new URLSearchParams();
  if (params.invoice_id) {
    q.set("invoice_id", params.invoice_id);
    q.set("focus", "record-payment");
  }
  if (params.filter === "today" || params.filter === "month") {
    q.set("receipts", params.filter);
  } else if (params.receipts === "today" || params.receipts === "month") {
    q.set("receipts", params.receipts);
  }
  const s = q.toString();
  redirect(s ? `/ar?${s}` : "/ar");
}
