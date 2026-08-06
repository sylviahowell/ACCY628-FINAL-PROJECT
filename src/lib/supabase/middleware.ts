import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { AUTH_FETCH_TIMEOUT_MS, withTimeout } from "@/lib/with-timeout";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Missing env crashes createServerClient on Edge → Vercel MIDDLEWARE_INVOCATION_FAILED.
  // Fail soft: let public pages load; app layout still redirects unauthenticated users.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "middleware: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set",
    );
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  let supabase;
  try {
    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });
  } catch (err) {
    console.error("middleware: failed to create Supabase client", err);
    return NextResponse.next({ request });
  }

  const path = request.nextUrl.pathname;
  const isStaticAsset =
    path.startsWith("/pod-samples/") ||
    path.startsWith("/pod-uploads/") ||
    path.startsWith("/insurance-uploads/") ||
    path.startsWith("/brand/");
  if (isStaticAsset) {
    return NextResponse.next();
  }

  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/health");

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
    } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_FETCH_TIMEOUT_MS,
      "middleware getUser",
    );
    user = authUser;
  } catch {
    // Hung / unreachable Auth — fail open so a slow network does not wipe the session
    // mid-navigation. Page-level getCurrentProfile still enforces sign-in.
    return supabaseResponse;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup" || path === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Role-based route guard: keep each portal on its own menu paths
  if (user && !isPublic) {
    try {
      const { data: profile } = await withTimeout(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
        AUTH_FETCH_TIMEOUT_MS,
        "middleware profile role",
      );
      if (profile?.role && !canAccessPath(profile.role as UserRole, path)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } catch {
      // If profile lookup hangs, allow through; page-level auth will re-check
    }
  }

  return supabaseResponse;
}
