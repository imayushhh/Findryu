"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { alertLostReportOwners } from "@/lib/alerts";
import { emailFinderItemReceived, emailFoundReportSubmitted } from "@/lib/email";
import type { CurrentProfile } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/auth";
import { routes, staffItemPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { torontoDateTimeToIso } from "@/lib/time";
import {
  fieldErrorsFrom,
  foundItemSchema,
  hiddenDetailSchema,
  itemWriteError,
  transferSchema,
} from "@/lib/validations/item";

const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 10 * 1024 * 1024;

export type ItemFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function loginRedirect(next: string): never {
  redirect(`${routes.login}?next=${encodeURIComponent(next)}`);
}

function requireProfile(profile: CurrentProfile | null, next: string): CurrentProfile {
  if (!profile) {
    loginRedirect(next);
  }
  return profile;
}

function requireStaff(profile: CurrentProfile) {
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }
}

function photoProblem(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) {
    return "Add a photo.";
  }
  if (!photoTypes.has(file.type)) {
    return "Use a JPEG or PNG photo.";
  }
  if (file.size > maxPhotoBytes) {
    return "That photo is over 10 MB. Choose a smaller one.";
  }
  return null;
}

function extensionFor(type: string) {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  return "jpg";
}

async function uploadItemPhoto(
  profileId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const supabase = await createClient();
  const path = `${profileId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error } = await supabase.storage.from("item-photos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return { error: "The photo could not be uploaded. Try again." };
  }
  return { path };
}

async function removeItemPhoto(path: string) {
  const supabase = await createClient();
  await supabase.storage.from("item-photos").remove([path]);
}

function foundAtError(value: string) {
  const iso = torontoDateTimeToIso(value);
  if (!iso) {
    return { fieldErrors: { foundAt: "Enter a valid date and time." } };
  }
  if (new Date(iso).getTime() > Date.now() + 5 * 60 * 1000) {
    return { fieldErrors: { foundAt: "The found time cannot be in the future." } };
  }
  return { iso };
}

export async function reportFoundItem(formData: FormData): Promise<ItemFormState> {
  const profile = requireProfile(await getCurrentProfile(), routes.report);
  const parsed = foundItemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    buildingId: formData.get("buildingId"),
    foundAt: formData.get("foundAt"),
    locationId: formData.get("locationId"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const foundAt = foundAtError(parsed.data.foundAt);
  if ("fieldErrors" in foundAt) {
    return foundAt;
  }

  const photoError = photoProblem(formData.get("photo"));
  if (photoError) {
    return { fieldErrors: { photo: photoError } };
  }

  const supabase = await createClient();
  const { data: desk } = await supabase
    .from("locations")
    .select("id")
    .eq("id", parsed.data.locationId)
    .eq("active", true)
    .eq("is_drop_off", true)
    .maybeSingle();
  if (!desk) {
    return { fieldErrors: { locationId: "Choose an active drop-off desk." } };
  }

  const uploaded = await uploadItemPhoto(profile.id, formData.get("photo") as File);
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const { data: refCode, error } = await supabase.rpc("report_found_item", {
    p_category_id: parsed.data.categoryId,
    p_description: parsed.data.description,
    p_building_id: parsed.data.buildingId,
    p_found_at: foundAt.iso,
    p_location_id: parsed.data.locationId,
    p_photo_path: uploaded.path,
  });

  if (error || typeof refCode !== "string") {
    console.error("report_found_item failed:", error?.message ?? "no reference returned");
    await removeItemPhoto(uploaded.path);
    return { error: itemWriteError(error?.message ?? "") };
  }

  await emailFoundReportSubmitted(profile.email, refCode, parsed.data.locationId);
  revalidatePath(routes.staff);
  redirect(`${routes.reportSuccess}?ref=${encodeURIComponent(refCode)}`);
}

export async function logWalkInItem(formData: FormData): Promise<ItemFormState> {
  const profile = requireProfile(await getCurrentProfile(), routes.staffIntake);
  requireStaff(profile);

  const locationId =
    profile.role === "admin" ? String(formData.get("locationId") ?? "") : profile.locationId;
  if (!locationId) {
    return {
      error: "An admin must assign this staff account to a desk before walk-ins can be logged.",
    };
  }

  const parsed = foundItemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    buildingId: formData.get("buildingId"),
    foundAt: formData.get("foundAt"),
    locationId,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const hidden = hiddenDetailSchema.safeParse(formData.get("hiddenDetail"));
  if (!hidden.success) {
    return { fieldErrors: { hiddenDetail: hidden.error.issues[0]?.message ?? "Enter a hidden detail." } };
  }

  const foundAt = foundAtError(parsed.data.foundAt);
  if ("fieldErrors" in foundAt) {
    return foundAt;
  }

  const photoError = photoProblem(formData.get("photo"));
  if (photoError) {
    return { fieldErrors: { photo: photoError } };
  }

  const supabase = await createClient();
  const { data: desk } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("active", true)
    .maybeSingle();
  if (!desk) {
    return { fieldErrors: { locationId: "Choose an active desk." } };
  }

  const uploaded = await uploadItemPhoto(profile.id, formData.get("photo") as File);
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const { data: itemId, error } = await supabase.rpc("log_walk_in_item", {
    p_category_id: parsed.data.categoryId,
    p_description: parsed.data.description,
    p_building_id: parsed.data.buildingId,
    p_found_at: foundAt.iso,
    p_location_id: locationId,
    p_photo_path: uploaded.path,
    p_hidden_detail: hidden.data,
  });

  if (error || typeof itemId !== "string") {
    console.error("log_walk_in_item failed:", error?.message ?? "no item id returned");
    await removeItemPhoto(uploaded.path);
    return { error: itemWriteError(error?.message ?? "") };
  }

  await alertLostReportOwners(itemId);
  revalidatePath(routes.staff);
  redirect(`${staffItemPath(itemId)}?notice=received`);
}

export async function receiveItem(
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const profile = requireProfile(await getCurrentProfile(), routes.staff);
  requireStaff(profile);
  const itemId = String(formData.get("itemId") ?? "");
  const hidden = hiddenDetailSchema.safeParse(formData.get("hiddenDetail"));
  if (!hidden.success) {
    return {
      fieldErrors: {
        hiddenDetail: hidden.error.issues[0]?.message ?? "Enter a hidden detail.",
      },
    };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, status, intended_location_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.status !== "reported") {
    return { error: "This item is not waiting to be received." };
  }

  const { error: secretError } = await supabase.from("item_secrets").insert({
    item_id: item.id,
    hidden_detail: hidden.data,
    recorded_by: profile.id,
  });
  if (secretError && secretError.code !== "23505") {
    return { error: itemWriteError(secretError.message) };
  }
  if (secretError) {
    const { error: updateError } = await supabase
      .from("item_secrets")
      .update({ hidden_detail: hidden.data })
      .eq("item_id", item.id);
    if (updateError) {
      return { error: itemWriteError(updateError.message) };
    }
  }

  const { error } = await supabase
    .from("items")
    .update({
      status: "received",
      current_location_id: item.intended_location_id,
    })
    .eq("id", item.id);
  if (error) {
    return { error: itemWriteError(error.message) };
  }

  await Promise.all([alertLostReportOwners(item.id), emailFinderItemReceived(item.id)]);
  revalidatePath(routes.staff);
  revalidatePath(staffItemPath(item.id));
  redirect(`${staffItemPath(item.id)}?notice=received`);
}

export async function updateHiddenDetail(
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const profile = requireProfile(await getCurrentProfile(), routes.staff);
  requireStaff(profile);
  const itemId = String(formData.get("itemId") ?? "");
  const hidden = hiddenDetailSchema.safeParse(formData.get("hiddenDetail"));
  if (!hidden.success) {
    return {
      fieldErrors: {
        hiddenDetail: hidden.error.issues[0]?.message ?? "Enter a hidden detail.",
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("item_secrets")
    .update({ hidden_detail: hidden.data })
    .eq("item_id", itemId);
  if (error) {
    return { error: itemWriteError(error.message) };
  }

  revalidatePath(staffItemPath(itemId));
  redirect(`${staffItemPath(itemId)}?notice=secret`);
}

export async function transferItem(
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const profile = requireProfile(await getCurrentProfile(), routes.staff);
  requireStaff(profile);
  const parsed = transferSchema.safeParse({
    itemId: formData.get("itemId"),
    toLocationId: formData.get("toLocationId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, status, current_location_id")
    .eq("id", parsed.data.itemId)
    .maybeSingle();
  if (!item?.current_location_id || (item.status !== "received" && item.status !== "in_transit")) {
    return { error: "Receive the item before transferring it." };
  }
  if (item.current_location_id === parsed.data.toLocationId) {
    return { fieldErrors: { toLocationId: "Choose a different desk." } };
  }

  const { error: transferError } = await supabase.from("item_transfers").insert({
    item_id: item.id,
    from_location_id: item.current_location_id,
    to_location_id: parsed.data.toLocationId,
    reason: parsed.data.reason,
    sent_by: profile.id,
  });
  if (transferError) {
    return { error: itemWriteError(transferError.message) };
  }

  const { error } = await supabase
    .from("items")
    .update({
      status: "in_transit",
      current_location_id: parsed.data.toLocationId,
    })
    .eq("id", item.id);
  if (error) {
    return { error: itemWriteError(error.message) };
  }

  revalidatePath(routes.staff);
  revalidatePath(staffItemPath(item.id));
  redirect(`${staffItemPath(item.id)}?notice=transferred`);
}

export async function markTransferArrived(formData: FormData) {
  const profile = requireProfile(await getCurrentProfile(), routes.staff);
  requireStaff(profile);
  const itemId = String(formData.get("itemId") ?? "");
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, status")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.status !== "in_transit") {
    redirect(`${staffItemPath(itemId)}?notice=unchanged`);
  }

  await supabase
    .from("item_transfers")
    .update({
      received_by: profile.id,
      received_at: new Date().toISOString(),
    })
    .eq("item_id", item.id)
    .is("received_at", null);

  const { error } = await supabase.from("items").update({ status: "received" }).eq("id", item.id);
  if (error) {
    redirect(`${staffItemPath(item.id)}?notice=unchanged`);
  }

  revalidatePath(routes.staff);
  revalidatePath(staffItemPath(item.id));
  redirect(`${staffItemPath(item.id)}?notice=arrived`);
}
