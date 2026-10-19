"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CurrentProfile } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/auth";
import { routes, staffClaimPath, staffItemPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type ReviewFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const idSchema = z.uuid();
const reasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason.")
  .max(500, "Keep the reason under 500 characters.");

async function requireStaff(next: string): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(next)}`);
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }
  return profile;
}

function claimIdFrom(formData: FormData) {
  const parsed = idSchema.safeParse(formData.get("claimId"));
  return parsed.success ? parsed.data : null;
}

function decisionError(message: string, code?: string) {
  if (code === "23505") {
    return "Another claim for this item is already approved. Reject or reopen that one first.";
  }
  if (message.includes("on hold until")) {
    return "This claim is still on hold. Approve it after the hold ends.";
  }
  if (message.includes("reason is required")) {
    return "Give a reason for rejecting the claim.";
  }
  return "The claim could not be updated. Refresh the page and try again.";
}

/** Fetched only when staff press the reveal button. RLS limits it to the item's desk. */
export async function revealHiddenDetail(claimId: string): Promise<{ detail?: string; error?: string }> {
  await requireStaff(routes.staff);
  if (!idSchema.safeParse(claimId).success) {
    return { error: "This claim could not be found." };
  }

  const supabase = await createClient();
  const { data: claim } = await supabase.from("claims").select("item_id").eq("id", claimId).maybeSingle();
  if (!claim) {
    return { error: "This claim could not be found." };
  }

  const { data: secret } = await supabase
    .from("item_secrets")
    .select("hidden_detail")
    .eq("item_id", claim.item_id)
    .maybeSingle();
  if (!secret) {
    return { error: "No hidden detail is recorded for this item, or it is not at your desk." };
  }
  return { detail: secret.hidden_detail };
}

export async function approveClaim(
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const claimId = claimIdFrom(formData);
  await requireStaff(claimId ? staffClaimPath(claimId) : routes.staff);
  if (!claimId) {
    return { error: "This claim could not be found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({ status: "approved" })
    .eq("id", claimId)
    .in("status", ["pending", "on_hold"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("approveClaim failed:", error.message);
    }
    return { error: error ? decisionError(error.message, error.code) : "This claim can no longer be approved." };
  }

  revalidatePath(routes.staff);
  redirect(`${staffClaimPath(claimId)}?notice=approved`);
}

export async function rejectClaim(
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const claimId = claimIdFrom(formData);
  await requireStaff(claimId ? staffClaimPath(claimId) : routes.staff);
  if (!claimId) {
    return { error: "This claim could not be found." };
  }

  const reason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!reason.success) {
    return { fieldErrors: { reason: reason.error.issues[0]?.message ?? "Give a reason." } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({ status: "rejected", rejection_reason: reason.data })
    .eq("id", claimId)
    .in("status", ["pending", "on_hold", "approved"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("rejectClaim failed:", error.message);
    }
    return { error: error ? decisionError(error.message, error.code) : "This claim can no longer be rejected." };
  }

  revalidatePath(routes.staff);
  redirect(`${staffClaimPath(claimId)}?notice=rejected`);
}

export async function recordHandover(
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const claimId = claimIdFrom(formData);
  const profile = await requireStaff(claimId ? staffClaimPath(claimId) : routes.staff);
  if (!claimId) {
    return { error: "This claim could not be found." };
  }
  if (formData.get("photoIdChecked") !== "on") {
    return { fieldErrors: { photoIdChecked: "Check the owner's photo ID, then tick the box." } };
  }

  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select("id, item_id, status, items(current_location_id)")
    .eq("id", claimId)
    .maybeSingle();
  const item = Array.isArray(claim?.items) ? claim.items[0] : claim?.items;
  if (!claim || claim.status !== "approved" || !item?.current_location_id) {
    return { error: "Only an approved claim can be handed over." };
  }

  const { error } = await supabase.from("handovers").insert({
    claim_id: claim.id,
    item_id: claim.item_id,
    staff_id: profile.id,
    location_id: item.current_location_id,
    photo_id_checked: true,
  });

  if (error) {
    console.error("recordHandover failed:", error.message);
    if (error.message.includes("must be at a desk")) {
      return { error: "Mark the item as arrived at this desk before handing it over." };
    }
    if (error.message.includes("own drop-off point") || error.message.includes("current desk")) {
      return { error: "The item must be handed over at the desk where it is now." };
    }
    return { error: "The handover could not be recorded. Refresh the page and try again." };
  }

  revalidatePath(routes.staff);
  redirect(`${staffClaimPath(claimId)}?notice=collected`);
}

export async function reopenContested(
  _previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const itemId = idSchema.safeParse(formData.get("itemId"));
  await requireStaff(itemId.success ? staffItemPath(itemId.data) : routes.staff);
  if (!itemId.success) {
    return { error: "This item could not be found." };
  }

  const reason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!reason.success) {
    return { fieldErrors: { reason: reason.error.issues[0]?.message ?? "Give a reason." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_contested", {
    p_item_id: itemId.data,
    p_reason: reason.data,
  });
  if (error) {
    console.error("reopen_contested failed:", error.message);
    if (error.message.includes("reopen_contested")) {
      return { error: "Reopening is not set up yet. Run supabase/migrations/011_contested.sql." };
    }
    return { error: "Only a collected item at your desk can be reopened." };
  }

  revalidatePath(routes.staff);
  redirect(`${staffItemPath(itemId.data)}?notice=contested`);
}

/** The claimant asks for after-hours pickup at Security Services. */
export async function requestAfterHoursPickup(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.my)}`);
  }
  const claimId = claimIdFrom(formData);
  if (!claimId) {
    redirect(routes.my);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_security_pickup", { claim_id: claimId });
  if (error) {
    console.error("request_security_pickup failed:", error.message);
    redirect(`${routes.my}?notice=pickup-failed`);
  }
  redirect(`${routes.my}?notice=pickup`);
}
