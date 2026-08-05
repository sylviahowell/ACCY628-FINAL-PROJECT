import { cookies } from "next/headers";
import { DEMO_MODE_COOKIE } from "@/lib/demo-mode";

/** True only when Demo Mode cookie is set (presentation tooling, not RLS). */
export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_MODE_COOKIE)?.value === "1";
}

export async function setDemoModeCookie(enabled: boolean) {
  const store = await cookies();
  if (enabled) {
    store.set(DEMO_MODE_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12, // 12 hours — demo session
    });
  } else {
    store.delete(DEMO_MODE_COOKIE);
  }
}
