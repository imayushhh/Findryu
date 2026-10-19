import { Suspense } from "react";

import { saveCategory } from "@/actions/catalog";
import { AdminForm } from "@/components/admin/admin-forms";
import { SelectField, TextField } from "@/components/admin/fields";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Categories",
};

const handling: [string, string][] = [
  ["none", "No special handling"],
  ["yu_card", "YU-card: send to the YU-card office"],
  ["passport", "Passport or government ID: send to Security Services"],
];

export default function AdminCategoriesPage() {
  return (
    <PageShell title="Categories" wide>
      <Suspense fallback={<p>Loading categories…</p>}>
        <CategoriesPanel />
      </Suspense>
    </PageShell>
  );
}

async function CategoriesPanel() {
  await requireAdminPage(routes.adminCategories);
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name, special_handling").order("name");
  if (error) {
    return <p>Categories could not be loaded. Refresh the page.</p>;
  }

  return (
    <>
      <section aria-labelledby="add-category" className="space-y-3 rounded-lg border border-border p-4">
        <h2 id="add-category" className="text-lg font-semibold">
          Add a category
        </h2>
        <AdminForm action={saveCategory} submitLabel="Add category">
          <input type="hidden" name="id" value="" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="new-category" name="name" label="Name" />
            <SelectField id="new-handling" name="specialHandling" label="Special handling" defaultValue="none" options={handling} />
          </div>
        </AdminForm>
      </section>
      <ul className="grid gap-3">
        {(data ?? []).map((category) => (
          <li key={category.id} className="rounded-lg border border-border p-4">
            <AdminForm action={saveCategory} submitLabel={<>Save<span className="sr-only"> {category.name}</span></>}>
              <input type="hidden" name="id" value={category.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${category.id}-name`} name="name" label="Name" defaultValue={category.name} />
                <SelectField
                  id={`${category.id}-handling`}
                  name="specialHandling"
                  label="Special handling"
                  defaultValue={category.special_handling}
                  options={handling}
                />
              </div>
            </AdminForm>
          </li>
        ))}
      </ul>
    </>
  );
}
