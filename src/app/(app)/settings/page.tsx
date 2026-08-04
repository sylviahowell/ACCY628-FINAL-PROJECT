import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { reviewApproval } from "@/lib/actions/freight";
import { createClient } from "@/lib/supabase/server";
import { ThemeSelector } from "@/components/ThemeSelector";
import { money } from "@/lib/types";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const { data: approvals } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm opacity-70">Account, theme, and business controls.</p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Your profile</h2>
          <p><b>{profile.full_name}</b> · {profile.email}</p>
          <p className="capitalize">Role: {profile.role}</p>
          <div className="mt-3 max-w-xs">
            <p className="mb-2 text-sm font-medium">Theme</p>
            <ThemeSelector />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Business controls (built in)</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Proof of delivery required before invoicing / completing a load</li>
            <li>Duplicate invoice numbers blocked</li>
            <li>Cancelled shipments cannot be invoiced</li>
            <li>Cannot complete without an assigned carrier</li>
            <li>Discounts and large accessorials need manager approval (threshold {money(settings?.accessorial_approval_threshold ?? 250)})</li>
            <li>Negative margin warnings on shipment pages</li>
            <li>Disputed invoices cannot be marked paid in full until resolved</li>
          </ul>
        </div>
      </div>

      {profile.role === "manager" ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Pending approvals</h2>
            {(approvals ?? []).length === 0 ? (
              <p className="text-sm opacity-70">No pending requests.</p>
            ) : (
              <ul className="space-y-3">
                {(approvals ?? []).map((a) => (
                  <li key={a.id} className="rounded-box border border-base-300 p-3">
                    <p className="font-medium capitalize">
                      {a.request_type} · {money(a.amount)}
                    </p>
                    <p className="text-sm opacity-70">{a.reason}</p>
                    <div className="mt-2 flex gap-2">
                      <form action={reviewApproval}>
                        <input type="hidden" name="approval_id" value={a.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <button className="btn btn-success btn-xs">Approve</button>
                      </form>
                      <form action={reviewApproval}>
                        <input type="hidden" name="approval_id" value={a.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button className="btn btn-error btn-xs">Reject</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
