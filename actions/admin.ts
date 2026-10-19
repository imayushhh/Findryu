"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { roleChangeSchema } from "@/lib/validations/admin";

export type RoleFormState = {
  error?: string;
  saved?: string;
};

export async function updateUserRole(
  _previous: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.adminUsers)}`);
  }
  if (profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }

  const parsed = roleChangeSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    locationId: formData.get("locationId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the role and desk." };
  }

  const { userId, role } = parsed.data;
  if (userId === profile.id && role !== "admin") {
    return { error: "You cannot remove your own admin role. Ask another admin to do it." };
  }

  // Admins work at every desk, and plain users have none.
  const locationId = role === "staff" ? parsed.data.locationId : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role, location_id: locationId })
    .eq("id", userId)
    .select("email")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("updateUserRole failed:", error.message);
    }
    return { error: "The role could not be saved. Refresh the page and try again." };
  }

  revalidatePath(routes.adminUsers);
  return { saved: `Saved. ${data.email} is now ${role === "user" ? "a user" : role === "staff" ? "staff" : "an admin"}.` };
}
