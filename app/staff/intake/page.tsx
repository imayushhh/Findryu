import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FoundItemForm } from "@/components/items/found-item-form";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { isSpecialHandling } from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Log a walk-in",
};

export default function IntakePage() {
  return (
    <PageShell title="Log a walk-in">
      <Suspense fallback={<p>Loading the form…</p>}>
        <IntakePanel />
      </Suspense>
    </PageShell>
  );
}

async function IntakePanel() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.staffIntake)}`);
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }

  const supabase = await createClient();
  const [categories, buildings, dropOffs, assigned] = await Promise.all([
    supabase.from("categories").select("id, name, special_handling").order("name"),
    supabase.from("buildings").select("id, name").eq("active", true).order("name"),
    supabase
      .from("locations")
      .select("id, name")
      .eq("active", true)
      .eq("is_drop_off", true)
      .order("name"),
    profile.locationId
      ? supabase.from("locations").select("id, name").eq("id", profile.locationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (categories.error || buildings.error || dropOffs.error || assigned.error) {
    return <p>The form could not be loaded. Refresh the page and try again.</p>;
  }

  if (profile.role === "staff" && !assigned.data) {
    return <p>An admin must assign this account to a desk before walk-ins can be logged.</p>;
  }

  return (
    <>
      <p>
        Use this when someone hands an item to the desk in person. It is marked
        received immediately.
      </p>
      <FoundItemForm
        mode="intake"
        categories={(categories.data ?? []).map((category) => ({
          id: category.id,
          name: category.name,
          specialHandling: isSpecialHandling(category.special_handling)
            ? category.special_handling
            : "none",
        }))}
        buildings={buildings.data ?? []}
        locations={dropOffs.data ?? []}
        lockedLocation={profile.role === "staff" ? assigned.data : null}
      />
    </>
  );
}
