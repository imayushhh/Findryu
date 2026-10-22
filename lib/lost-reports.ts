import { createClient } from "@/lib/supabase/server";

export async function loadLostReportChoices() {
  const supabase = await createClient();
  const [categories, buildings] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("buildings").select("id, name").eq("active", true).order("name"),
  ]);
  if (categories.error || buildings.error) {
    return null;
  }
  return { categories: categories.data ?? [], buildings: buildings.data ?? [] };
}
