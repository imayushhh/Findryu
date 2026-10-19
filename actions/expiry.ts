"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CurrentProfile } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/auth";
import { routes, staffItemPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type ExpiryFormState = {
  error?: string;
  saved?: string;
};

const photoTypes = new Set(["image/jpeg", "image/png"]);
const maxPhotoBytes = 10 * 1024 * 1024;

const archiveSchema = z.object({
  itemId: z.uuid(),
  outcome: z.enum(["donated", "disposed"], { error: "Choose donated or disposed." }),
});

async function requireRole(roles: CurrentProfile["role"][], next: string): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(next)}`);
  }
  if (!roles.includes(profile.role)) {
    redirect(`${routes.home}?notice=forbidden`);
  }
  return profile;
}

export async function archiveItem(_previous: ExpiryFormState, formData: FormData): Promise<ExpiryFormState> {
  await requireRole(["staff", "admin"], routes.staff);
  const parsed = archiveSchema.safeParse({ itemId: formData.get("itemId"), outcome: formData.get("outcome") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose donated or disposed." };
  }

  const supabase = await createClient();
  const { data: paths, error } = await supabase.rpc("archive_item", {
    p_item_id: parsed.data.itemId,
    p_outcome: parsed.data.outcome,
  });
  if (error) {
    console.error("archive_item failed:", error.message);
    return { error: "The item could not be archived. Only a received item at your desk can be archived." };
  }

  if (Array.isArray(paths) && paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("item-photos").remove(paths);
    if (storageError) {
      console.error("archive photo removal failed:", storageError.message);
    }
  }

  revalidatePath(routes.staff);
  redirect(`${staffItemPath(parsed.data.itemId)}?notice=archived`);
}

export async function restoreItem(_previous: ExpiryFormState, formData: FormData): Promise<ExpiryFormState> {
  const profile = await requireRole(["admin"], routes.adminArchived);
  const itemId = z.uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) {
    return { error: "This item could not be found." };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Add a new photo. The old photos were deleted when the item was archived." };
  }
  if (!photoTypes.has(photo.type)) {
    return { error: "Use a JPEG or PNG photo." };
  }
  if (photo.size > maxPhotoBytes) {
    return { error: "That photo is over 10 MB. Choose a smaller one." };
  }

  const supabase = await createClient();
  const path = `${profile.id}/${crypto.randomUUID()}.${photo.type === "image/png" ? "png" : "jpg"}`;
  const { error: uploadError } = await supabase.storage
    .from("item-photos")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (uploadError) {
    return { error: "The photo could not be uploaded. Try again." };
  }

  const { error } = await supabase.rpc("restore_item", { p_item_id: itemId.data, p_photo_path: path });
  if (error) {
    console.error("restore_item failed:", error.message);
    await supabase.storage.from("item-photos").remove([path]);
    return { error: "The item could not be restored. Refresh the page and try again." };
  }

  revalidatePath(routes.adminArchived);
  redirect(`${routes.adminArchived}?notice=restored`);
}

export async function runPrivacyCleanup(): Promise<ExpiryFormState> {
  await requireRole(["admin"], routes.adminSettings);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_privacy_cleanup");
  if (error) {
    console.error("run_privacy_cleanup failed:", error.message);
    return { error: "The privacy cleanup could not run. Try again." };
  }

  revalidatePath(routes.adminAudit);
  const count = typeof data === "number" ? data : 0;
  return {
    saved:
      count === 0
        ? "Cleanup finished. No claims were old enough to clear."
        : `Cleanup finished. Contact details were removed from ${count} ${count === 1 ? "claim" : "claims"}.`,
  };
}
