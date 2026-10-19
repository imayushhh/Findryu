"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type CatalogFormState = {
  error?: string;
  saved?: string;
};

const optionalId = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);
const name = z.string().trim().min(1, "Enter a name.").max(120, "Keep the name under 120 characters.");
const optionalText = z
  .string()
  .trim()
  .max(200, "Keep each field under 200 characters.")
  .transform((value) => value || null);
const checkbox = z.string().nullable().transform((value) => value === "on");

const settingsSchema = z.object({
  holding_period_days: z.coerce.number().int("Use whole days.").min(1, "The holding period must be at least 1 day.").max(3650),
  no_proof_hold_days: z.coerce.number().int("Use whole days.").min(0, "The hold cannot be negative.").max(365),
  contact_retention_days: z.coerce.number().int("Use whole days.").min(1, "Keep contact details at least 1 day.").max(3650),
});

const locationSchema = z.object({
  id: optionalId,
  name,
  kind: z.enum(["central", "library", "security", "yu_card_office"], { error: "Choose the kind of desk." }),
  building: optionalText,
  room: optionalText,
  hours: optionalText,
  isDropOff: checkbox,
  active: checkbox,
});

const buildingSchema = z.object({ id: optionalId, name, active: checkbox });

const categorySchema = z.object({
  id: optionalId,
  name,
  specialHandling: z.enum(["none", "yu_card", "passport"], { error: "Choose the special handling." }),
});

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.admin)}`);
  }
  if (profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }
}

function writeError(error: { code?: string; message: string }, what: string) {
  console.error(`save ${what} failed:`, error.message);
  if (error.code === "23505") {
    return { error: `Another ${what} already has that name.` };
  }
  if (error.code === "23503") {
    return { error: `This ${what} is still in use. Turn it off instead.` };
  }
  return { error: `The ${what} could not be saved. Refresh the page and try again.` };
}

export async function saveSettings(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  }

  const supabase = await createClient();
  const rows = Object.entries(parsed.data).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) {
    return writeError(error, "setting");
  }
  revalidatePath(routes.adminSettings);
  return { saved: "Settings saved. New claims and the dashboard use them right away." };
}

export async function saveLocation(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireAdmin();
  const parsed = locationSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    kind: formData.get("kind"),
    building: formData.get("building") ?? "",
    room: formData.get("room") ?? "",
    hours: formData.get("hours") ?? "",
    isDropOff: formData.get("isDropOff"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the desk details." };
  }

  const { id, isDropOff, ...rest } = parsed.data;
  const row = { ...rest, is_drop_off: isDropOff };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("locations").update(row).eq("id", id)
    : await supabase.from("locations").insert(row);
  if (error) {
    return writeError(error, "desk");
  }
  revalidatePath(routes.adminLocations);
  return { saved: id ? `Saved ${row.name}.` : `Added ${row.name}.` };
}

export async function saveBuilding(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireAdmin();
  const parsed = buildingSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    active: formData.get("active"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the building name." };
  }

  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("buildings").update(row).eq("id", id)
    : await supabase.from("buildings").insert(row);
  if (error) {
    return writeError(error, "building");
  }
  revalidatePath(routes.adminBuildings);
  return { saved: id ? `Saved ${row.name}.` : `Added ${row.name}.` };
}

export async function saveCategory(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    specialHandling: formData.get("specialHandling"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the category." };
  }

  const { id, specialHandling, ...rest } = parsed.data;
  const row = { ...rest, special_handling: specialHandling };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) {
    return writeError(error, "category");
  }
  revalidatePath(routes.adminCategories);
  return { saved: id ? `Saved ${row.name}.` : `Added ${row.name}.` };
}
