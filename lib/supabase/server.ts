import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/supabase/env";

/** Server Supabase client for Server Components, Server Actions, and Route Handlers. */
export async function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the session.
        }
      },
    },
  });
}
