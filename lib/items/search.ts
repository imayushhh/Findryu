import { deskPlace, related } from "@/lib/items/text";
import { signedItemPhotoUrls } from "@/lib/items/photos";
import { createClient } from "@/lib/supabase/server";
import { torontoDayRange } from "@/lib/time";

export const searchPageSize = 20;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listColumns =
  "id, ref_code, description, found_at, building_id, category_id, categories(name), buildings(name), current:locations!items_current_location_id_fkey(name, building, room), item_photos(storage_path)";

export type SearchResult = {
  id: string;
  refCode: string;
  description: string;
  foundAt: string;
  category: string;
  building: string;
  desk: string;
  photoUrl: string | null;
};

type RawItem = {
  id: string;
  ref_code: string;
  description: string;
  found_at: string;
  building_id: string;
  category_id: string;
  categories: { name: string } | { name: string }[] | null;
  buildings: { name: string } | { name: string }[] | null;
  current: { name: string; building: string | null; room: string | null } | { name: string; building: string | null; room: string | null }[] | null;
  item_photos: { storage_path: string }[] | null;
};

export type SearchFilters = {
  lostBuildingId: string;
  keyword: string;
  categoryId: string;
  buildingId: string;
  from: string;
  to: string;
  page: number;
};

export function readSearchFilters(params: {
  lost?: string;
  q?: string;
  category?: string;
  building?: string;
  from?: string;
  to?: string;
  page?: string;
}): SearchFilters | null {
  const lostBuildingId = params.lost ?? "";
  if (!uuidPattern.test(lostBuildingId)) {
    return null;
  }

  const page = Number(params.page ?? "1");
  return {
    lostBuildingId,
    keyword: (params.q ?? "").trim().slice(0, 80),
    categoryId: uuidPattern.test(params.category ?? "") ? (params.category as string) : "",
    buildingId: uuidPattern.test(params.building ?? "") ? (params.building as string) : "",
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? (params.from as string) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? (params.to as string) : "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export async function loadSearch(filters: SearchFilters) {
  const supabase = await createClient();
  const { data: lostBuilding } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("id", filters.lostBuildingId)
    .eq("active", true)
    .maybeSingle();

  if (!lostBuilding) {
    return null;
  }

  const dateError = filters.from && filters.to && filters.from > filters.to;
  const range =
    !dateError && (filters.from || filters.to)
      ? torontoDayRange(filters.from || filters.to, filters.to || filters.from)
      : null;

  const [page, suggestions] = await Promise.all([
    loadPage(filters, range),
    loadSuggestions(filters, range),
  ]);

  return {
    lostBuildingName: lostBuilding.name,
    dateError,
    ...page,
    suggestions,
  };
}

async function loadPage(
  filters: SearchFilters,
  range: { start: string; end: string } | null,
) {
  const supabase = await createClient();
  if (filters.buildingId) {
    const { data, count, error } = await applyFilters(
      supabase.from("items").select(listColumns, { count: "exact" }),
      filters,
      range,
    )
      .eq("building_id", filters.buildingId)
      .order("found_at", { ascending: false })
      .range((filters.page - 1) * searchPageSize, filters.page * searchPageSize - 1);

    const total = count ?? 0;
    return {
      error: Boolean(error),
      total,
      pageCount: Math.max(1, Math.ceil(total / searchPageSize)),
      results: await toResults((data ?? []) as RawItem[]),
    };
  }

  const lostCountQuery = applyFilters(
    supabase.from("items").select("id", { count: "exact", head: true }),
    filters,
    range,
  ).eq("building_id", filters.lostBuildingId);
  const otherCountQuery = applyFilters(
    supabase.from("items").select("id", { count: "exact", head: true }),
    filters,
    range,
  ).neq("building_id", filters.lostBuildingId);
  const [{ count: lostCount, error: lostError }, { count: otherCount, error: otherError }] =
    await Promise.all([lostCountQuery, otherCountQuery]);

  const lostTotal = lostCount ?? 0;
  const otherTotal = otherCount ?? 0;
  const total = lostTotal + otherTotal;
  const start = (filters.page - 1) * searchPageSize;
  const rows: RawItem[] = [];

  if (start < lostTotal) {
    const lostEnd = Math.min(lostTotal, start + searchPageSize) - 1;
    const { data } = await applyFilters(supabase.from("items").select(listColumns), filters, range)
      .eq("building_id", filters.lostBuildingId)
      .order("found_at", { ascending: false })
      .range(start, lostEnd);
    rows.push(...((data ?? []) as RawItem[]));
  }

  const stillNeeded = searchPageSize - rows.length;
  if (stillNeeded > 0 && start + rows.length < total) {
    const otherStart = Math.max(0, start - lostTotal);
    const { data } = await applyFilters(supabase.from("items").select(listColumns), filters, range)
      .neq("building_id", filters.lostBuildingId)
      .order("found_at", { ascending: false })
      .range(otherStart, otherStart + stillNeeded - 1);
    rows.push(...((data ?? []) as RawItem[]));
  }

  return {
    error: Boolean(lostError || otherError),
    total,
    pageCount: Math.max(1, Math.ceil(total / searchPageSize)),
    results: await toResults(rows),
  };
}

async function loadSuggestions(
  filters: SearchFilters,
  range: { start: string; end: string } | null,
) {
  const supabase = await createClient();
  const sameBuilding = applyFilters(
    supabase.from("items").select(listColumns),
    { ...filters, keyword: "" },
    range,
  )
    .eq("building_id", filters.lostBuildingId)
    .order("found_at", { ascending: false })
    .limit(8);

  const sameCategory = filters.categoryId
    ? applyFilters(
        supabase.from("items").select(listColumns),
        { ...filters, keyword: "" },
        range,
      )
        .eq("category_id", filters.categoryId)
        .neq("building_id", filters.lostBuildingId)
        .order("found_at", { ascending: false })
        .limit(8)
    : Promise.resolve({ data: [] as RawItem[] });

  const [buildingRows, categoryRows] = await Promise.all([sameBuilding, sameCategory]);
  const seen = new Set<string>();
  const candidates: RawItem[] = [];
  for (const row of [...((buildingRows.data ?? []) as RawItem[]), ...((categoryRows.data ?? []) as RawItem[])]) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    candidates.push(row);
  }

  candidates.sort((left, right) => {
    const score = suggestionScore(right, filters) - suggestionScore(left, filters);
    if (score !== 0) {
      return score;
    }
    return new Date(right.found_at).getTime() - new Date(left.found_at).getTime();
  });

  return toResults(candidates.slice(0, 5));
}

function suggestionScore(item: RawItem, filters: SearchFilters) {
  let score = 0;
  if (item.building_id === filters.lostBuildingId) {
    score += 4;
  }
  if (filters.categoryId && item.category_id === filters.categoryId) {
    score += 3;
  }
  if (filters.keyword && item.description.toLowerCase().includes(filters.keyword.toLowerCase())) {
    score += 1;
  }
  return score;
}

function applyFilters(
  // Supabase's filter builder is generic and changes type on each call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: SearchFilters,
  range: { start: string; end: string } | null,
) {
  let next = query.in("status", ["received", "in_transit"]);
  if (filters.keyword) {
    next = next.ilike("description", `%${escapeIlike(filters.keyword)}%`);
  }
  if (filters.categoryId) {
    next = next.eq("category_id", filters.categoryId);
  }
  if (range) {
    next = next.gte("found_at", range.start).lt("found_at", range.end);
  }
  return next;
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function toResults(rows: RawItem[]): Promise<SearchResult[]> {
  const paths = rows.flatMap((row) => row.item_photos?.map((photo) => photo.storage_path) ?? []).slice(0, 40);
  const urls = await signedItemPhotoUrls(paths);
  return rows.map((row) => {
    const photoPath = row.item_photos?.[0]?.storage_path;
    const current = related(row.current);
    return {
      id: row.id,
      refCode: row.ref_code,
      description: row.description,
      foundAt: row.found_at,
      category: related(row.categories)?.name ?? "Item",
      building: related(row.buildings)?.name ?? "Unknown building",
      desk: current ? deskPlace(current) : "Desk not recorded yet",
      photoUrl: photoPath ? (urls.get(photoPath) ?? null) : null,
    };
  });
}
