"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  demoUserForRole,
  isDemoUserEmail,
} from "@/lib/demo-mode";
import { isDemoMode, setDemoModeCookie } from "@/lib/demo-mode-server";
import { DEMO_PASSWORD, DEMO_USERS, type Profile, type UserRole } from "@/lib/types";
import { AUTH_FETCH_TIMEOUT_MS, withTimeout } from "@/lib/with-timeout";

function isMissingDemoUserError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("invalid email or password") ||
    m.includes("user not found")
  );
}

function isEmailRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("rate limit") || m.includes("over_email_send_rate_limit");
}

const DEMO_SIGNIN_HELP =
  " Demo accounts must already exist in Supabase Auth (password FreightDemo2026!). " +
  "Do not rely on auto sign-up — it sends confirmation emails and hits the free-tier rate limit. " +
  "In Auth → Providers → Email, turn off Confirm email, then create the five @rowanlane.example users.";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await withTimeout(
    supabase.auth.getUser(),
    AUTH_FETCH_TIMEOUT_MS,
    "getUser",
  );
  if (!user) return null;

  const { data } = await withTimeout(
    supabase
      .from("profiles")
      .select("id, email, full_name, role, customer_id, carrier_id")
      .eq("id", user.id)
      .maybeSingle(),
    AUTH_FETCH_TIMEOUT_MS,
    "getCurrentProfile",
  );

  return (data as Profile | null) ?? null;
}

async function signInDemoAccount(role: UserRole) {
  const demo = demoUserForRole(role);
  const supabase = await createClient();

  // Sign-in only — never signUp for demos. Client signUp triggers Supabase
  // confirmation emails and quickly hits the free-tier email rate limit.
  const { error: signInError } = await withTimeout(
    supabase.auth.signInWithPassword({
      email: demo.email,
      password: DEMO_PASSWORD,
    }),
    AUTH_FETCH_TIMEOUT_MS,
    "demo signIn",
  );

  if (!signInError) return;

  if (isEmailRateLimitError(signInError.message)) {
    throw new Error(
      "Email rate limit exceeded on this Supabase project. Wait about an hour, " +
        "or create/confirm demo users in the Auth dashboard without sending more emails." +
        DEMO_SIGNIN_HELP,
    );
  }

  if (isMissingDemoUserError(signInError.message)) {
    throw new Error(
      `Demo user ${demo.email} is missing or the password does not match.` +
        DEMO_SIGNIN_HELP,
    );
  }

  throw new Error(
    signInError.message +
      " Check Supabase connectivity and that demo users exist in Auth.",
  );
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const role = (String(formData.get("role") || "broker") as UserRole) || "broker";

  await setDemoModeCookie(false);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || email.split("@")[0],
        role: ["manager", "broker", "billing", "customer", "carrier"].includes(role)
          ? role
          : "broker",
      },
    },
  });

  if (error) throw new Error(error.message);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(
      signInError.message +
        " If email confirmation is on, turn it off in Supabase Auth settings for local testing.",
    );
  }

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  // Normal users must never inherit Demo Mode UI / switching
  await setDemoModeCookie(false);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

/** Legacy form helper — prefers enterDemoMode for portal cards. */
export async function loginAsDemo(email: string, _formData?: FormData) {
  const demo = DEMO_USERS.find((u) => u.email === email);
  if (!demo) throw new Error("Unknown demo user");
  await enterDemoMode(demo.role);
}

/**
 * Enter Demo Mode from an Explore Demo Portals card.
 * Credentials stay server-side; the visitor never enters a password.
 */
export async function enterDemoMode(role: UserRole, _formData?: FormData) {
  if (!DEMO_USERS.some((u) => u.role === role)) {
    throw new Error("Unknown demo role");
  }
  await setDemoModeCookie(true);
  await signInDemoAccount(role);
  revalidatePath("/", "layout");
  redirect(`/dashboard?portal=${encodeURIComponent(role)}`);
}

/**
 * Switch fictional demo identity without returning to the login page.
 * Only allowed while Demo Mode cookie is set AND the current session is a demo user.
 */
export async function switchDemoRole(role: UserRole) {
  if (!(await isDemoMode())) {
    throw new Error("Demo Role switching is only available in Demo Mode.");
  }

  const profile = await getCurrentProfile();
  if (!profile || !isDemoUserEmail(profile.email)) {
    await setDemoModeCookie(false);
    throw new Error("Demo Role switching is not available for this account.");
  }

  if (!DEMO_USERS.some((u) => u.role === role)) {
    throw new Error("Unknown demo role");
  }

  await signInDemoAccount(role);
  // Same-URL redirect is a no-op for RSC; bust cache and force a fresh portal shell.
  revalidatePath("/", "layout");
  redirect(`/dashboard?portal=${encodeURIComponent(role)}`);
}

/** Leave Demo Mode and return to the public entry page. */
export async function exitDemo() {
  await setDemoModeCookie(false);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signOut() {
  await setDemoModeCookie(false);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
