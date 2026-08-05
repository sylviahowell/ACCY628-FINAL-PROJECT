import { Shield } from "lucide-react";
import { FreightLoginHero } from "@/components/login/FreightLoginHero";
import { LoginForm } from "@/components/login/LoginForm";
import { DemoPortalGrid } from "@/components/login/DemoPortalGrid";
import { SecurityNotice } from "@/components/login/SecurityNotice";

export default function LoginPage() {
  return (
    <div className="login-page relative min-h-screen overflow-x-hidden text-[#0A1F3D]">
      {/*
        Full-page truck/mountain photograph (single truck only).
        Responsive crop via CSS background on .login-scenic-bg.
      */}
      <div className="login-scenic-bg pointer-events-none absolute inset-0 z-0" aria-hidden />
      {/* Soft full-page veil ~10% — keeps truck crisp/colorful */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[#F7FBFF]/10"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <div className="order-2 flex w-full flex-col lg:order-1 lg:w-[54%]">
          <FreightLoginHero />
        </div>

        <div className="order-1 flex w-full items-center justify-center px-4 py-8 sm:px-6 lg:order-2 lg:w-[46%] lg:px-10 lg:py-12 xl:px-14">
          <div className="login-float-panel flex w-full max-w-[440px] flex-col rounded-[24px] border border-[#E2EAF3] bg-white px-5 py-5 sm:px-6 sm:py-6 lg:max-w-[460px]">
            <div className="mb-3 flex justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-[#0866D9]">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Secure &amp; Encrypted
              </span>
            </div>

            <LoginForm />

            <div className="divider my-3 text-[11px] text-[#8A9BB0] before:bg-[#E2EAF3] after:bg-[#E2EAF3]">
              or
            </div>

            <DemoPortalGrid />

            <div className="mt-3.5">
              <SecurityNotice />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
