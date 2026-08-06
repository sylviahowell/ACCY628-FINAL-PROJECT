import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  ClipboardList,
  LogOut,
  Palette,
  Receipt,
  Shield,
  SlidersHorizontal,
  Truck,
  User,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { requirePathAccess } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { ThemeSelector } from "@/components/ThemeSelector";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { CompanyProfileSettings } from "@/components/CompanyProfileSettings";
import { BillingPreferences } from "@/components/BillingPreferences";
import { CarrierInsuranceForm } from "@/components/CarrierInsuranceForm";
import { updateAccessorialThreshold } from "@/lib/actions/freight";
import { ROLE_LABELS } from "@/lib/roles";
import { money } from "@/lib/types";
import { insuranceRiskStatus, insuranceStatusLabel } from "@/lib/risk-credit";
import { normalizePodUrl } from "@/lib/display-text";

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider opacity-50">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">{title}</h3>
              <p className="mt-1 text-sm opacity-70">{description}</p>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <dt className="text-xs uppercase tracking-wide opacity-55">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-right">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Shared Settings for every portal.
 * Account preferences for all roles; company / workspace controls gated by role.
 */
export default async function SettingsPage() {
  const profile = await requirePathAccess("/settings");

  const isManager = profile.role === "manager";
  const isBroker = profile.role === "broker";
  const isBilling = profile.role === "billing";
  const isCustomer = profile.role === "customer";
  const isCarrier = profile.role === "carrier";
  const supabase = await createClient();

  const { data: settings } = isManager
    ? await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    : { data: null };

  const { data: customerRecord } =
    isCustomer && profile.customer_id
      ? await supabase
          .from("customers")
          .select(
            "name, contact_name, contact_email, contact_phone, billing_address, payment_terms, credit_limit",
          )
          .eq("id", profile.customer_id)
          .maybeSingle()
      : { data: null };

  const { data: carrierRecord } =
    isCarrier && profile.carrier_id
      ? await supabase
          .from("carriers")
          .select(
            "name, mc_number, dot_number, contact_name, contact_email, contact_phone, equipment_type, service_area, insurance_expiration, insurance_certificate_url, rating",
          )
          .eq("id", profile.carrier_id)
          .maybeSingle()
      : { data: null };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-4">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm opacity-70">
          Account and preferences for {ROLE_LABELS[profile.role]}.
        </p>
      </header>

      <SettingsSection title="Account">
        <SettingsCard
          icon={<User className="h-5 w-5" aria-hidden />}
          title="Your profile"
          description="Signed-in identity for this portal."
        >
          <dl className="divide-y divide-base-300 rounded-lg border border-base-300">
            <DetailRow label="Name" value={profile.full_name} />
            <DetailRow label="Email" value={profile.email} />
            <DetailRow
              label="Role"
              value={<span className="badge badge-outline">{ROLE_LABELS[profile.role]}</span>}
            />
          </dl>
        </SettingsCard>

        <SettingsCard
          icon={<Palette className="h-5 w-5" aria-hidden />}
          title="Appearance"
          description="Choose how RowanLane looks on this device."
        >
          <ThemeSelector />
        </SettingsCard>

        <SettingsCard
          icon={<Bell className="h-5 w-5" aria-hidden />}
          title="Notification preferences"
          description="Device-local demo checkboxes only — they do not send email or SMS. Preferences stay in this browser for the pitch walkthrough."
        >
          <NotificationPreferences role={profile.role} />
        </SettingsCard>
      </SettingsSection>

      {isBroker ? (
        <SettingsSection title="Operations">
          <SettingsCard
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            title="Broker workspace"
            description="Day desk lives on Broker Operations — cover loads from the work queue, book from New shipment, and escalate accessorials from Warnings."
          >
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="link link-primary">
                  Open Broker Operations
                </Link>
              </li>
              <li>
                <Link href="/shipments/new" className="link link-hover">
                  Create shipment
                </Link>
              </li>
              <li>
                <Link href="/warnings" className="link link-hover">
                  Warning center
                </Link>
              </li>
            </ul>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {isBilling ? (
        <SettingsSection title="Billing">
          <SettingsCard
            icon={<Receipt className="h-5 w-5" aria-hidden />}
            title="Billing preferences"
            description="House payment-term reminders and how collections work is ordered on this device."
          >
            <BillingPreferences />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {isCustomer ? (
        <SettingsSection title="Company">
          <SettingsCard
            icon={<Building2 className="h-5 w-5" aria-hidden />}
            title="Company of record"
            description="Customer profile linked to this portal account. Contact RowanLane to request changes."
          >
            {customerRecord ? (
              <dl className="divide-y divide-base-300 rounded-lg border border-base-300">
                <DetailRow label="Company" value={customerRecord.name} />
                <DetailRow label="Contact" value={customerRecord.contact_name} />
                <DetailRow label="Email" value={customerRecord.contact_email} />
                <DetailRow label="Phone" value={customerRecord.contact_phone} />
                <DetailRow label="Billing address" value={customerRecord.billing_address} />
                <DetailRow label="Payment terms" value={customerRecord.payment_terms ?? "Net 30"} />
                <DetailRow
                  label="Credit limit"
                  value={
                    customerRecord.credit_limit != null
                      ? money(customerRecord.credit_limit)
                      : null
                  }
                />
              </dl>
            ) : (
              <p className="text-sm opacity-70">
                No customer company is linked to this account yet.
              </p>
            )}
            <p className="mt-3 text-sm opacity-70">
              Shipping contracts (rates, downpayment, end dates) are managed by RowanLane
              operations. You cannot cancel a contract from this portal — use Support to request a
              change.
            </p>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {isCarrier ? (
        <SettingsSection title="Carrier">
          <SettingsCard
            icon={<Truck className="h-5 w-5" aria-hidden />}
            title="Carrier profile"
            description="Authority and contact details on file with RowanLane. Read-only from your carrier record."
          >
            {carrierRecord ? (
              <dl className="divide-y divide-base-300 rounded-lg border border-base-300">
                <DetailRow label="Carrier" value={carrierRecord.name} />
                <DetailRow label="MC number" value={carrierRecord.mc_number} />
                <DetailRow label="DOT number" value={carrierRecord.dot_number} />
                <DetailRow label="Contact" value={carrierRecord.contact_name} />
                <DetailRow label="Email" value={carrierRecord.contact_email} />
                <DetailRow label="Phone" value={carrierRecord.contact_phone} />
                <DetailRow label="Equipment" value={carrierRecord.equipment_type} />
                <DetailRow label="Service area" value={carrierRecord.service_area} />
                <DetailRow
                  label="Insurance"
                  value={
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      <span>
                        {carrierRecord.insurance_expiration
                          ? `Expires ${carrierRecord.insurance_expiration}`
                          : "Not on file"}
                      </span>
                      <span className="badge badge-outline badge-sm">
                        {insuranceStatusLabel(
                          insuranceRiskStatus(
                            carrierRecord.insurance_expiration ?? null,
                            today,
                          ).status,
                        )}
                      </span>
                      {normalizePodUrl(carrierRecord.insurance_certificate_url) ? (
                        <a
                          href={normalizePodUrl(carrierRecord.insurance_certificate_url)!}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-primary text-sm"
                        >
                          Certificate
                        </a>
                      ) : null}
                    </span>
                  }
                />
                <DetailRow
                  label="Rating"
                  value={
                    carrierRecord.rating != null ? String(carrierRecord.rating) : null
                  }
                />
              </dl>
            ) : (
              <p className="text-sm opacity-70">
                No carrier record is linked to this account yet.
              </p>
            )}
            <p className="mt-3 text-sm opacity-70">
              Haul agreements and rate contracts are managed by RowanLane operations. Carriers
              cannot cancel or rewrite brokerage contracts from this portal — contact your
              RowanLane rep for changes.
            </p>
          </SettingsCard>

          {carrierRecord ? (
            <SettingsCard
              icon={<Shield className="h-5 w-5" aria-hidden />}
              title="Insurance certificate"
              description="Upload a current COI and set the expiration date. Expired insurance blocks new load assignments until you renew."
            >
              <CarrierInsuranceForm
                currentExpiration={carrierRecord.insurance_expiration}
                certificateUrl={carrierRecord.insurance_certificate_url}
                today={today}
              />
            </SettingsCard>
          ) : null}
        </SettingsSection>
      ) : null}

      {isManager ? (
        <SettingsSection title="Company">
          <SettingsCard
            icon={<Building2 className="h-5 w-5" aria-hidden />}
            title="Brokerage profile"
            description="Company identity used when presenting RowanLane."
          >
            <CompanyProfileSettings />
          </SettingsCard>

          <SettingsCard
            icon={<SlidersHorizontal className="h-5 w-5" aria-hidden />}
            title="Approval controls"
            description="Accessorials at or above this amount need manager approval before billing. Broker-entered discounts always require approval."
          >
            <form action={updateAccessorialThreshold} className="space-y-3">
              <fieldset className="fieldset max-w-xs">
                <legend className="fieldset-legend">Accessorial threshold (USD)</legend>
                <input
                  name="accessorial_approval_threshold"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={settings?.accessorial_approval_threshold ?? 250}
                  className="input w-full"
                  required
                />
                <p className="fieldset-label">Charges above this route to your Approval Inbox.</p>
              </fieldset>
              <button className="btn btn-primary btn-sm">Save threshold</button>
            </form>
          </SettingsCard>

          <SettingsCard
            icon={<Shield className="h-5 w-5" aria-hidden />}
            title="System control policies"
            description="Rules the application always enforces in server actions. These are not toggles."
          >
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-55">
                  Preventive (hard stops)
                </p>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {[
                    "Proof of delivery required before invoicing or completing a load",
                    "Cannot complete a shipment without an assigned carrier",
                    "Cancelled shipments cannot be invoiced",
                    "Duplicate invoice numbers blocked",
                    "Any payment blocked while an invoice is disputed",
                    "Credit limit checked at booking — brokers blocked; manager override logged",
                    "Expired carrier insurance blocked on create/assign (all roles)",
                    "Only active contracts on new shipments; outside-window dates need confirm",
                    "Broker discounts and accessorials above threshold need manager approval",
                    "Negative-margin loads blocked for brokers; manager override logged",
                  ].map((rule) => (
                    <li key={rule} className="flex gap-2 opacity-80">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-error/70"
                      />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-55">
                  Detective / monitoring (warnings only)
                </p>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {[
                    "Insurance expiring ≤30 days and Watch List carriers surface on Risk & Warnings",
                    "Approvals inbox, Control activity log, AR collections notes for follow-up",
                  ].map((rule) => (
                    <li key={rule} className="flex gap-2 opacity-80">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning/80"
                      />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded-lg border border-base-300 bg-base-200/60 px-3 py-2 text-xs opacity-80">
                Separation of duties: managers may book, bill, and approve in this demo. Compensating
                controls are logged overrides, the Approvals inbox, Risk & Credit, and{" "}
                <Link href="/controls" className="link">
                  Control activity
                </Link>
                — not a second approver.
              </p>
            </div>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      <SettingsSection title="Session">
        <SettingsCard
          icon={<LogOut className="h-5 w-5" aria-hidden />}
          title="Sign out"
          description="End this session and return to the login screen."
          action={
            <form action={signOut}>
              <button type="submit" className="btn btn-outline btn-sm">
                Sign out
              </button>
            </form>
          }
        />
      </SettingsSection>
    </div>
  );
}
