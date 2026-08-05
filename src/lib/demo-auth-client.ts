"use client";

import { createClient } from "@/lib/supabase/client";
import { demoUserForRole } from "@/lib/demo-mode";
import { DEMO_PASSWORD, type UserRole } from "@/lib/types";

/**
 * Switch / enter a demo identity in the browser so auth cookies update reliably.
 * Server-action signIn+signOut often leaves a stale session with @supabase/ssr.
 */
export async function clientSignInDemoRole(role: UserRole) {
  const demo = demoUserForRole(role);
  const supabase = createClient();

  await supabase.auth.signOut();

  const { error } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: DEMO_PASSWORD,
  });

  if (error) {
    throw new Error(
      error.message.includes("Invalid") || error.message.includes("invalid")
        ? `Demo user ${demo.email} is missing or the password does not match. Use password FreightDemo2026!.`
        : error.message,
    );
  }
}
