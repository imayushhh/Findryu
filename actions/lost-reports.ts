"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { emailLostReportSaved } from "@/lib/email";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { torontoToday } from "@/lib/time";
import { lostReportSchema } from "@/lib/validations/lost-report";

export type LostReportFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const photoTypes = new Set(["image/jpeg", "image/png"]);
const maxPhotoBytes = 10 * 1024 * 1024;

async function requireSignedIn() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.lostReportNew)}`);
  }
  return profile;
}

export async function saveLostReport(formData: FormData): Promise<LostReportFormState> {
  const profile = await requireSignedIn();
  const id = z.union([z.uuid(), z.literal("")]).safeParse(formData.get("id") ?? "");
  if (!id.success) {
    return { error: "This lost report could not be found." };
  }

  const parsed = lostReportSchema.safeParse({
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    buildingId: formData.get("buildingId"),
    lostFrom: formData.get("lostFrom"),
    lostTo: formData.get("lostTo"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  if (parsed.data.lostTo > torontoToday()) {
    return { fieldErrors: { lostTo: "The dates cannot be in the future." } };
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && !photoTypes.has(photo.type)) {
    return { fieldErrors: { photo: "Use a JPEG or PNG photo." } };
  }
  if (hasPhoto && photo.size > maxPhotoBytes) {
    return { fieldErrors: { photo: "That photo is over 10 MB. Choose a smaller one." } };
  }

  const supabase = await createClient();
  let previousPhoto: string | null = null;
  if (id.data) {
    const { data: existing } = await supabase
      .from("lost_reports")
      .select("status, photo_path")
      .eq("id", id.data)
      .maybeSingle();
    if (!existing || existing.status !== "active") {
      return { error: "Only an active lost report can be edited." };
    }
    previousPhoto = existing.photo_path;
  }

  let photoPath: string | undefined;
  if (hasPhoto) {
    photoPath = `${profile.id}/lost-${crypto.randomUUID()}.${photo.type === "image/png" ? "png" : "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(photoPath, photo, { contentType: photo.type, upsert: false });
    if (uploadError) {
      return { fieldErrors: { photo: "The photo could not be uploaded. Try again." } };
    }
  }

  const row = {
    category_id: parsed.data.categoryId,
    description: parsed.data.description,
    building_id: parsed.data.buildingId,
    lost_from: parsed.data.lostFrom,
    lost_to: parsed.data.lostTo,
    ...(photoPath ? { photo_path: photoPath } : {}),
  };
  const { error } = id.data
    ? await supabase.from("lost_reports").update(row).eq("id", id.data)
    : await supabase.from("lost_reports").insert({ ...row, owner_id: profile.id });
  if (error) {
    console.error("save lost report failed:", error.message);
    if (photoPath) {
      await supabase.storage.from("item-photos").remove([photoPath]);
    }
    return { error: "Your lost report could not be saved. Try again." };
  }
  if (photoPath && previousPhoto) {
    await supabase.storage.from("item-photos").remove([previousPhoto]);
  }
  if (!id.data) {
    await emailLostReportSaved(profile.email, parsed.data.description);
  }

  revalidatePath(routes.my);
  redirect(`${routes.my}?notice=${id.data ? "lost-updated" : "lost-saved"}`);
}

export async function cancelLostReport(formData: FormData) {
  await requireSignedIn();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) {
    redirect(`${routes.my}?notice=lost-failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lost_reports")
    .update({ status: "cancelled" })
    .eq("id", id.data)
    .eq("status", "active")
    .select("photo_path");
  if (error || !data || data.length === 0) {
    redirect(`${routes.my}?notice=lost-failed`);
  }
  if (data[0].photo_path) {
    await supabase.storage.from("item-photos").remove([data[0].photo_path]);
    await supabase.from("lost_reports").update({ photo_path: null }).eq("id", id.data);
  }

  revalidatePath(routes.my);
  redirect(`${routes.my}?notice=lost-cancelled`);
}
