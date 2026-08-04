"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const role = (String(formData.get("role") || "broker") as UserRole) || "broker";

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
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export async function loginAsDemo(email: string, _formData?: FormData) {
  const demo = DEMO_USERS.find((u) => u.email === email);
  if (!demo) throw new Error("Unknown demo user");

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

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
