import { Shield } from "lucide-react";

export function SecurityNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[#E2EAF3] bg-[#F5F9FD] px-3 py-2">
      <span className="mt-0.5 rounded-md bg-sky-100/80 p-1 text-[#0866D9]">
        <Shield className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0A1F3D]">Your data is safe with us.</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#7A8BA0]">
          We use secure authentication and role-based access to protect your information.
        </p>
      </div>
    </div>
  );
}
