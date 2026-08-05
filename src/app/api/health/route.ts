import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_FETCH_TIMEOUT_MS, withTimeout } from "@/lib/with-timeout";
import { logEvent } from "@/lib/log-event";

export const dynamic = "force-dynamic";

/** Ops readiness probe — Auth reachable within timeout. */
export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    await withTimeout(supabase.auth.getSession(), AUTH_FETCH_TIMEOUT_MS, "health getSession");
    return NextResponse.json({
      ok: true,
      service: "rowanlane",
      auth: "up",
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "health_failed";
    logEvent({ level: "error", action: "health", error: message });
    return NextResponse.json(
      {
        ok: false,
        service: "rowanlane",
        auth: "down",
        error: message,
        latencyMs: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
