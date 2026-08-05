import type { ReactNode } from "react";
import { enterDemoMode } from "@/lib/actions/auth";
import { DEMO_USERS, type UserRole } from "@/lib/types";

export type PortalCardVisual = {
  role: UserRole;
  titleLines: [string, string];
  description: string;
  /** Soft tinted card background */
  tint: string;
  /** Icon container classes */
  iconWrap: string;
  /** Bottom accent color class */
  bar: string;
  icon: ReactNode;
};

export function demoEmailForRole(role: UserRole): string {
  const user = DEMO_USERS.find((u) => u.role === role);
  if (!user) throw new Error(`Missing demo user for role ${role}`);
  return user.email;
}

export function DemoPortalCard({ visual }: { visual: PortalCardVisual }) {
  return (
    <form action={enterDemoMode.bind(null, visual.role)} className="min-w-0">
      <button
        type="submit"
        className={`login-portal-card group flex h-[148px] w-full flex-col items-center overflow-hidden rounded-[12px] border border-[#E2EAF3] px-1.5 pt-2.5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0866D9] focus-visible:ring-offset-2 ${visual.tint}`}
      >
        {/* Fixed icon slot — identical height/position on every card */}
        <span className="flex h-9 w-full shrink-0 items-center justify-center" aria-hidden>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${visual.iconWrap}`}>
            {visual.icon}
          </span>
        </span>

        {/* Fixed title slot */}
        <span className="mt-2 flex h-[28px] w-full shrink-0 items-start justify-center px-0.5 text-[11px] font-bold leading-[14px] text-[#0A1F3D]">
          <span className="text-center">
            {visual.titleLines[0]}
            <br />
            {visual.titleLines[1]}
          </span>
        </span>

        {/* Fixed description slot */}
        <span className="mt-1.5 flex h-[32px] w-full flex-1 items-start justify-center px-0.5 text-[9px] font-normal leading-[11px] text-[#7A8BA0]">
          <span className="line-clamp-3 text-center">{visual.description}</span>
        </span>

        {/* Exact 4px accent bar */}
        <span className={`portal-bar mt-auto block w-full shrink-0 ${visual.bar}`} aria-hidden />
      </button>
    </form>
  );
}
