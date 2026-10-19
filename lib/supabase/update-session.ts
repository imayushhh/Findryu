import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAdminPath, isStaffOrAdminPath, routes } from "@/lib/routes";
import { getSupabaseEnv } from "@/lib/supabase/env";

function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  search: Record<string, string>,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";
  for (const [key, value] of Object.entries(search)) {
    redirectUrl.searchParams.set(key, value);
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) {
      redirectResponse.headers.set(header, value);
    }
  }

  return redirectResponse;
}

/**
 * Refreshes the Supabase session.
 * Signed-out visitors are sent to /login.
 * /staff requires staff or admin. /admin requires admin.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const protectedPath = isStaffOrAdminPath(pathname);
  const env = getSupabaseEnv();

  if (!env) {
    if (protectedPath) {
      return redirectWithSession(request, supabaseResponse, routes.login, {
        next: pathname,
      });
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  let userId: string | null = null;

  try {
    const { data, error } = await supabase.auth.getClaims();
    userId = !error && data?.claims.sub ? data.claims.sub : null;
  } catch {
    userId = null;
  }

  if (!protectedPath) {
    return supabaseResponse;
  }

  if (!userId) {
    return redirectWithSession(request, supabaseResponse, routes.login, {
      next: pathname,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role;
  const allowed = isAdminPath(pathname)
    ? role === "admin"
    : role === "staff" || role === "admin";

  if (!allowed) {
    return redirectWithSession(request, supabaseResponse, routes.home, {
      notice: "forbidden",
    });
  }

  return supabaseResponse;
}
