import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FoundItemForm } from "@/components/items/found-item-form";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { isSpecialHandling } from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Report a found item",
};

export default function ReportPage() {
  return (
    <PageShell title="Report a found item">
      <Suspense fallback={<p>Loading the form…</p>}>
        <ReportPanel />
      </Suspense>
    </PageShell>
  );
}

async function ReportPanel() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.report)}`);
  }

  const choices = await loadChoices();
  if (!choices) {
    return <p>The form could not be loaded. Refresh the page and try again.</p>;
  }

  return (
    <>
      <p>
        Describe what you found, add a photo, and choose the Keele desk where
        you will drop it off.
      </p>
      <FoundItemForm
        mode="report"
        categories={choices.categories}
        buildings={choices.buildings}
        locations={choices.dropOffs}
      />
    </>
  );
}

async function loadChoices() {
  const supabase = await createClient();
  const [categories, buildings, dropOffs] = await Promise.all([
    supabase.from("categories").select("id, name, special_handling").order("name"),
    supabase.from("buildings").select("id, name").eq("active", true).order("name"),
    supabase
      .from("locations")
      .select("id, name")
      .eq("active", true)
      .eq("is_drop_off", true)
      .order("name"),
  ]);

  if (categories.error || buildings.error || dropOffs.error) {
    return null;
  }

  return {
    categories: (categories.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      specialHandling: isSpecialHandling(category.special_handling)
        ? category.special_handling
        : "none",
    })),
    buildings: buildings.data ?? [],
    dropOffs: dropOffs.data ?? [],
  };
}
