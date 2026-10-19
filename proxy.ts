import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/update-session";

/**
 * Next.js 16 runs this file instead of middleware.ts.
 * It refreshes the auth session and blocks /staff and /admin when signed out.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
