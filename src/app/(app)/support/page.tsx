import Link from "next/link";
import { requirePathAccess } from "@/lib/authz";

export default async function SupportPage() {
  await requirePathAccess("/support");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm opacity-70">
          Help with your shipments, invoices, and billing questions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Track a shipment</h2>
            <p className="text-sm opacity-70">
              See live status, pickup, and delivery details for your freight.
            </p>
            <Link href="/shipments" className="btn btn-primary btn-sm w-fit">
              My shipments
            </Link>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Question a charge</h2>
            <p className="text-sm opacity-70">
              Open a billing dispute from an invoice if an accessorial or amount looks wrong.
            </p>
            <Link href="/invoices" className="btn btn-outline btn-sm w-fit">
              My invoices
            </Link>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm md:col-span-2">
          <div className="card-body">
            <h2 className="card-title text-base">Brokerage contact</h2>
            <p className="text-sm">
              FreightFlow Support Desk ·{" "}
              <span className="font-mono">support@freightflow.example</span> · (312) 555-0199
            </p>
            <p className="text-xs opacity-60">
              Simulated contact for the class demo — no real tickets are sent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
