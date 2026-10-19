import { Suspense } from "react";

import { RestoreForm } from "@/components/admin/admin-forms";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin";
import { related } from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

export const metadata = {
  title: "Archived items",
};

export default function AdminArchivedPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <PageShell title="Archived items" wide>
      <Suspense fallback={<p>Loading archived items…</p>}>
        <ArchivedPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ArchivedPanel({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireAdminPage(routes.adminArchived);
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, ref_code, description, archived_outcome, archived_at, categories(name), current:locations!items_current_location_id_fkey(name), archiver:profiles!items_archived_by_fkey(email)",
    )
    .eq("status", "archived")
    .order("archived_at", { ascending: false })
    .limit(100);
  if (error) {
    return <p>Archived items could not be loaded. Refresh the page.</p>;
  }

  return (
    <>
      {notice === "restored" ? (
        <p role="status" className="rounded-lg border border-border bg-card p-4">
          The item is restored. It is back at its desk and visible in search.
        </p>
      ) : null}
      <p>
        Restoring puts the item back at the desk that archived it and restarts its holding period. The old photos
        were deleted when it was archived, so add a new one.
      </p>
      {(data ?? []).length === 0 ? <p>No items are archived.</p> : null}
      <ul className="grid gap-3">
        {(data ?? []).map((item) => (
          <li key={item.id} className="space-y-2 rounded-lg border border-border p-4">
            <p className="font-semibold">{item.ref_code}</p>
            <p className="break-words">{item.description}</p>
            <p className="text-sm text-muted-foreground">
              {[
                related(item.categories)?.name,
                item.archived_outcome === "donated" ? "Donated" : "Disposed",
                item.archived_at ? formatToronto(item.archived_at) : null,
                related(item.archiver)?.email,
                related(item.current)?.name,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <RestoreForm itemId={item.id} refCode={item.ref_code} />
          </li>
        ))}
      </ul>
    </>
  );
}
