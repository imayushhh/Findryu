import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type AppRole = "user" | "staff" | "admin";

export type CurrentProfile = {
  id: string;
  email: string;
  role: AppRole;
  fullName: string | null;
  locationId: string | null;
};

function isAppRole(value: unknown): value is AppRole {
  return value === "user" || value === "staff" || value === "admin";
}

/** The signed-in profile, or null when there is no session. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role, full_name, location_id")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: profile?.email ?? "",
    role: isAppRole(profile?.role) ? profile.role : "user",
    fullName: profile?.full_name ?? null,
    locationId: profile?.location_id ?? null,
  };
}
