"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_PASSWORD, DEMO_USERS, type Profile } from "@/lib/types";

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

  return data as Profile | null;
}

export async function ensureDemoUsers() {
  const supabase = await createClient();
  const results: string[] = [];

  for (const demo of DEMO_USERS) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: demo.email,
      password: DEMO_PASSWORD,
    });

    if (!signInError) {
      await supabase.auth.signOut();
      results.push(`${demo.email}: exists`);
      continue;
    }

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

    if (signUpError) {
      results.push(`${demo.email}: ${signUpError.message}`);
    } else {
      await supabase.auth.signOut();
      results.push(`${demo.email}: created`);
    }
  }

  return results;
}

export async function loginAsDemo(email: string, _formData?: FormData) {
  const supabase = await createClient();
  const demo = DEMO_USERS.find((u) => u.email === email);
  if (!demo) {
    throw new Error("Unknown demo user");
  }

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

    if (signUpError) {
      throw new Error(signUpError.message);
    }

    const { error: secondSignIn } = await supabase.auth.signInWithPassword({
      email: demo.email,
      password: DEMO_PASSWORD,
    });
    if (secondSignIn) {
      throw new Error(
        secondSignIn.message +
          " If email confirmation is required, disable it in Supabase Auth settings for demo accounts.",
      );
    }
  }

  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
