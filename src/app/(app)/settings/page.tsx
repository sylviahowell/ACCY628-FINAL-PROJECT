import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { ThemeSelector } from "@/components/ThemeSelector";
import { updateAccessorialThreshold } from "@/lib/actions/freight";
import { ROLE_LABELS } from "@/lib/roles";
import { Palette } from "lucide-react";

/**
 * Shared Settings for every portal.
 * Appearance is available to all roles; manager-only controls stay gated.
 */
export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isManager = profile.role === "manager";
  const supabase = await createClient();

  const { data: settings } = isManager
    ? await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    : { data: null };

  const { data: approvals } = isManager
    ? await supabase
        .from("approval_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; request_type: string; amount: number; reason: string | null }[] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm opacity-70">
          Account preferences for {ROLE_LABELS[profile.role]}.
        </p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-2">
          <h2 className="card-title text-base">Your profile</h2>
          <p>
            <b>{profile.full_name}</b> · {profile.email}
          </p>
          <p className="text-sm opacity-70">{ROLE_LABELS[profile.role]}</p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Palette className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="card-title text-base">Appearance</h2>
              <p className="text-sm opacity-70">
                Choose how RowanLane looks on this device.
              </p>
            </div>
          </div>
          <ThemeSelector />
        </div>
      </div>

      {isManager ? (
        <>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <h2 className="card-title text-base">Approval threshold</h2>
              <p className="text-sm opacity-70">
                Accessorials at or above this amount require manager approval before they can be
                billed.
              </p>
              <form action={updateAccessorialThreshold} className="flex flex-wrap items-end gap-3">
                <label className="form-control">
                  <span className="label-text text-xs">Amount (USD)</span>
                  <input
                    name="accessorial_approval_threshold"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={settings?.accessorial_approval_threshold ?? 250}
                    className="input input-bordered w-40"
                    required
                  />
                </label>
                <button className="btn btn-primary btn-sm">Save threshold</button>
              </form>
              <details className="collapse collapse-arrow rounded-box border border-base-300 bg-base-200/50">
                <summary className="collapse-title min-h-0 py-2 text-sm font-medium">
                  Control policies
                </summary>
                <div className="collapse-content">
                  <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
                    <li>Proof of delivery required before invoicing / completing a load</li>
                    <li>Duplicate invoice numbers blocked</li>
                    <li>Cancelled shipments cannot be invoiced</li>
                    <li>Cannot complete without an assigned carrier</li>
                    <li>Negative margin warnings on shipment pages</li>
                    <li>Disputed invoices cannot be marked paid in full until resolved</li>
                    <li>Credit limit checked at booking (manager override logged)</li>
                    <li>Revenue treated as earned at delivery + POD — see Accounting workspace</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Pending approvals</h2>
              <p className="text-sm opacity-70">
                {(approvals ?? []).length} request(s) waiting. Review and decide in the Approval
                Inbox — rejections require a comment.
              </p>
              <Link href="/approvals" className="btn btn-primary btn-sm w-fit">
                Open Approval Inbox
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
