import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { routes } from "@/lib/routes";

export async function requireAdminPage(next: string) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(next)}`);
  }
  if (profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }
  return profile;
}
