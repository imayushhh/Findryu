import Link from "next/link";
import { Suspense } from "react";

import { controlClassName } from "@/components/items/field";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin";
import { related } from "@/lib/items/text";
import { routes, staffClaimPath, staffItemPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Audit log",
};

const pageSize = 50;
const types: [string, string][] = [
  ["", "Everything"],
  ["item", "Items"],
  ["claim", "Claims"],
  ["privacy_cleanup", "Privacy cleanup runs"],
];

type Search = { type?: string; ref?: string; page?: string };

export default function AdminAuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <PageShell title="Audit log" wide>
      <Suspense fallback={<p>Loading the audit log…</p>}>
        <AuditPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function describe(row: { entity_type: string; action: string; old_status: string | null; new_status: string | null; details: Record<string, unknown> }) {
  if (row.entity_type === "privacy_cleanup") {
    return `Privacy cleanup cleared ${String(row.details.claims_cleared ?? 0)} claims (older than ${String(row.details.retention_days ?? "?")} days)`;
  }
  const label = (status: string | null) => (status ?? "").replaceAll("_", " ");
  if (row.action === "insert") {
    return `Created as ${label(row.new_status)}`;
  }
  return `${label(row.old_status)} → ${label(row.new_status)}`;
}

async function AuditPanel({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdminPage(routes.adminAudit);
  const params = await searchParams;
  const type = types.some(([value]) => value === params.type) ? (params.type ?? "") : "";
  const ref = (params.ref ?? "").trim().toUpperCase().slice(0, 20);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  let itemId: string | null = null;
  if (ref) {
    const { data: item } = await supabase.from("items").select("id").eq("ref_code", ref).maybeSingle();
    itemId = item?.id ?? null;
  }

  let query = supabase
    .from("audit_log")
    .select("id, entity_type, entity_id, action, old_status, new_status, details, created_at, actor:profiles(email)")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize);
  if (type) {
    query = query.eq("entity_type", type);
  }
  if (ref) {
    query = itemId ? query.or(`entity_id.eq.${itemId},details->>item_id.eq.${itemId}`) : query.eq("entity_id", "00000000-0000-0000-0000-000000000000");
  }
  const { data, error } = await query;
  if (error) {
    return <p>The audit log could not be loaded. Refresh the page.</p>;
  }

  const rows = (data ?? []).slice(0, pageSize);
  const hasMore = (data ?? []).length > pageSize;
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (type) search.set("type", type);
    if (ref) search.set("ref", ref);
    search.set("page", String(target));
    return `${routes.adminAudit}?${search}`;
  };

  return (
    <>
      <p>Every item and claim status change is recorded with who made it. Entries cannot be edited or deleted.</p>
      <form action={routes.adminAudit} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label htmlFor="audit-type" className="text-sm font-medium">
            Show
          </label>
          <select id="audit-type" name="type" defaultValue={type} className={controlClassName()}>
            {types.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="audit-ref" className="text-sm font-medium">
            Item reference
          </label>
          <input id="audit-ref" name="ref" type="search" placeholder="FYU-000123" defaultValue={ref} className={controlClassName()} />
        </div>
        <button type="submit" className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
          Filter
        </button>
      </form>

      {ref && !itemId ? <p>No item has the reference {ref}.</p> : null}
      {rows.length === 0 && (!ref || itemId) ? <p>No entries match.</p> : null}
      <ol className="grid gap-2">
        {rows.map((row) => {
          const details = (row.details ?? {}) as Record<string, unknown>;
          const href =
            row.entity_type === "item" ? staffItemPath(row.entity_id) : row.entity_type === "claim" ? staffClaimPath(row.entity_id) : null;
          const name =
            row.entity_type === "item" ? String(details.ref_code ?? "Item") : row.entity_type === "claim" ? "Claim" : "Privacy cleanup";
          return (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <p>
                {href ? (
                  <Link href={href} className={textLinkClass}>
                    {name}
                  </Link>
                ) : (
                  <span className="font-medium">{name}</span>
                )}
                : {describe({ ...row, details })}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatToronto(row.created_at)} · {related(row.actor)?.email ?? "system or deleted account"}
              </p>
            </li>
          );
        })}
      </ol>
      <nav aria-label="Audit log pages" className="flex gap-4">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className={textLinkClass}>
            Newer entries
          </Link>
        ) : null}
        {hasMore ? (
          <Link href={pageHref(page + 1)} className={textLinkClass}>
            Older entries
          </Link>
        ) : null}
      </nav>
    </>
  );
}
