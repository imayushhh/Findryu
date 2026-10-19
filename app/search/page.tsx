import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ItemCard } from "@/components/items/item-card";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { loadSearch, readSearchFilters } from "@/lib/items/search";
import { routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Search",
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    lost?: string;
    q?: string;
    category?: string;
    building?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  return (
    <PageShell title="Search" wide>
      <Suspense fallback={<p>Loading search…</p>}>
        <SearchPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function SearchPanel({
  searchParams,
}: {
  searchParams: Promise<{
    lost?: string;
    q?: string;
    category?: string;
    building?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.search)}`);
  }

  const params = await searchParams;
  const filters = readSearchFilters(params);
  if (!filters) {
    return <BuildingStep />;
  }

  const search = await loadSearch(filters);
  if (!search) {
    return <BuildingStep />;
  }

  const supabase = await createClient();
  const [buildings, categories] = await Promise.all([
    supabase.from("buildings").select("id, name").eq("active", true).order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const query = searchQuery(filters);

  return (
    <>
      <p>
        You lost it in <span className="font-medium">{search.lostBuildingName}</span>. Items
        found in that building are listed first.
      </p>
      <p>
        <Link href={routes.search} className={textLinkClass}>
          Choose a different building
        </Link>
      </p>
      <form action={routes.search} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="lost" value={filters.lostBuildingId} />
        <label className="space-y-1 text-sm font-medium">
          Keyword
          <input
            name="q"
            defaultValue={filters.keyword}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base font-normal"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={filters.categoryId}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base font-normal"
          >
            <option value="">Any category</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Building found
          <select
            name="building"
            defaultValue={filters.buildingId}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base font-normal"
          >
            <option value="">All buildings, chosen building first</option>
            {(buildings.data ?? []).map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Found from
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base font-normal"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Found to
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base font-normal"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="bg-primary text-primary-foreground min-h-11 rounded-lg px-4 text-sm font-medium"
          >
            Search
          </button>
        </div>
      </form>
      {search.dateError ? <p role="alert">The start date must be on or before the end date.</p> : null}
      {search.error ? <p>The search could not be loaded. Try again.</p> : null}

      <section aria-labelledby="suggested-matches" className="space-y-3">
        <h2 id="suggested-matches" className="text-xl font-semibold tracking-tight">
          Suggested matches
        </h2>
        <p className="text-sm text-muted-foreground">
          Ranked by the building you chose, then category, then date.
        </p>
        {search.suggestions.length === 0 ? <p>No received items match closely enough yet.</p> : null}
        <ul className="grid gap-3">
          {search.suggestions.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="search-results" className="space-y-3">
        <h2 id="search-results" className="text-xl font-semibold tracking-tight">
          Results
        </h2>
        <p className="text-sm text-muted-foreground">
          {search.total} {search.total === 1 ? "item" : "items"}. Page {filters.page} of{" "}
          {search.pageCount}.
        </p>
        {search.results.length === 0 ? <p>No received items match this search.</p> : null}
        <ul className="grid gap-3">
          {search.results.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
        <nav aria-label="Search pages" className="flex gap-4">
          {filters.page > 1 ? (
            <Link href={`${routes.search}?${queryFor(query, filters.page - 1)}`} className={textLinkClass}>
              Previous page
            </Link>
          ) : null}
          {filters.page < search.pageCount ? (
            <Link href={`${routes.search}?${queryFor(query, filters.page + 1)}`} className={textLinkClass}>
              Next page
            </Link>
          ) : null}
        </nav>
      </section>
    </>
  );
}

function queryFor(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return next.toString();
}

function searchQuery(filters: {
  lostBuildingId: string;
  keyword: string;
  categoryId: string;
  buildingId: string;
  from: string;
  to: string;
}) {
  const params = new URLSearchParams();
  params.set("lost", filters.lostBuildingId);
  if (filters.keyword) {
    params.set("q", filters.keyword);
  }
  if (filters.categoryId) {
    params.set("category", filters.categoryId);
  }
  if (filters.buildingId) {
    params.set("building", filters.buildingId);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  return params;
}

async function BuildingStep() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (error) {
    return <p>Buildings could not be loaded. Refresh the page and try again.</p>;
  }

  return (
    <>
      <h2 className="text-xl font-semibold tracking-tight">Which building did you lose it in?</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(data ?? []).map((building) => (
          <li key={building.id}>
            <Link
              href={`${routes.search}?lost=${building.id}`}
              className="flex min-h-11 items-center rounded-lg border border-border px-3 py-2 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {building.name}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
