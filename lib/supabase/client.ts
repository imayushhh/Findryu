import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/env";

/** Browser Supabase client. Use only in Client Components. */
export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
