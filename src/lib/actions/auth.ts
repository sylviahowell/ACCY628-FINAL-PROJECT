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

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, customer_id, carrier_id")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

async function signInDemoAccount(role: UserRole) {
  const demo = demoUserForRole(role);
  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: DEMO_PASSWORD,
  });

  if (signInError) {
    const { error: signUpError } = await supabase.auth.signUp({
      email: demo.email,
      password: DEMO_PASSWORD,
      options: {
        data: {
          full_name: demo.full_name,
          role: demo.role,
          customer_id: demo.customer_id ?? "",
          carrier_id: demo.carrier_id ?? "",
        },
      },
    });
    if (signUpError) throw new Error(signUpError.message);

    const { error: second } = await supabase.auth.signInWithPassword({
      email: demo.email,
      password: DEMO_PASSWORD,
    });
    if (second) {
      throw new Error(
        second.message +
          " Turn off Confirm email in Supabase Auth → Providers → Email for demo accounts.",
      );
    }
  }
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
