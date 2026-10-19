import { Suspense } from "react";

import { saveBuilding } from "@/actions/catalog";
import { AdminForm } from "@/components/admin/admin-forms";
import { CheckboxField, TextField } from "@/components/admin/fields";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Buildings",
};

export default function AdminBuildingsPage() {
  return (
    <PageShell title="Buildings" wide>
      <Suspense fallback={<p>Loading buildings…</p>}>
        <BuildingsPanel />
      </Suspense>
    </PageShell>
  );
}

async function BuildingsPanel() {
  await requireAdminPage(routes.adminBuildings);
  const supabase = await createClient();
  const { data, error } = await supabase.from("buildings").select("id, name, active").order("name");
  if (error) {
    return <p>Buildings could not be loaded. Refresh the page.</p>;
  }

  return (
    <>
      <p>Turn a building off to hide it from the report and search forms. Items already found there keep it.</p>
      <section aria-labelledby="add-building" className="space-y-3 rounded-lg border border-border p-4">
        <h2 id="add-building" className="text-lg font-semibold">
          Add a building
        </h2>
        <AdminForm action={saveBuilding} submitLabel="Add building" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="id" value="" />
          <input type="hidden" name="active" value="on" />
          <TextField id="new-building" name="name" label="Name" />
        </AdminForm>
      </section>
      <ul className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((building) => (
          <li key={building.id} className="rounded-lg border border-border p-4">
            <AdminForm action={saveBuilding} submitLabel={<>Save<span className="sr-only"> {building.name}</span></>}>
              <input type="hidden" name="id" value={building.id} />
              <TextField id={`${building.id}-name`} name="name" label="Name" defaultValue={building.name} />
              <CheckboxField id={`${building.id}-active`} name="active" label="Active" defaultChecked={building.active} />
            </AdminForm>
          </li>
        ))}
      </ul>
    </>
  );
}
