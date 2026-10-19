"use server";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { itemClaimPath, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/lib/validations/item";
import { claimSchema, claimWriteError, maxProofFiles } from "@/lib/validations/claim";

export type ClaimFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const proofTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProofBytes = 10 * 1024 * 1024;

function extensionFor(type: string) {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  return "jpg";
}

export async function submitClaim(formData: FormData): Promise<ClaimFormState> {
  const ref = String(formData.get("ref") ?? "");
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(itemClaimPath(ref))}`);
  }

  const parsed = claimSchema.safeParse({
    itemId: formData.get("itemId"),
    hiddenDetailAnswer: formData.get("hiddenDetailAnswer") ?? "",
    noProof: formData.get("noProof") === "on",
    proofNote: formData.get("proofNote") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const claim = parsed.data;

  const files = claim.noProof
    ? []
    : formData
        .getAll("proofFiles")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > maxProofFiles) {
    return { fieldErrors: { proofFiles: `Add up to ${maxProofFiles} proof files.` } };
  }
  if (files.some((file) => !proofTypes.has(file.type))) {
    return { fieldErrors: { proofFiles: "Proof files must be JPEG or PNG images." } };
  }
  if (files.some((file) => file.size > maxProofBytes)) {
    return { fieldErrors: { proofFiles: "Each proof file must be under 10 MB." } };
  }
  if (!claim.noProof && files.length === 0 && !claim.proofNote) {
    return {
      fieldErrors: {
        proofFiles: "Add a proof file or a proof note, or tick No proof available.",
      },
    };
  }

  const supabase = await createClient();
  const uploaded: string[] = [];
  for (const file of files) {
    const path = `${profile.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await supabase.storage.from("claim-proofs").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      if (uploaded.length) {
        await supabase.storage.from("claim-proofs").remove(uploaded);
      }
      return { error: "A proof file could not be uploaded. Try again." };
    }
    uploaded.push(path);
  }

  const { error } = await supabase.rpc("submit_claim", {
    p_item_id: claim.itemId,
    p_hidden_detail_answer: claim.hiddenDetailAnswer,
    p_proof_note: claim.noProof ? "" : claim.proofNote,
    p_no_proof: claim.noProof,
    p_contact_phone: claim.noProof ? claim.contactPhone : "",
    p_contact_address: claim.noProof ? claim.contactAddress : "",
    p_proof_paths: uploaded,
  });

  if (error) {
    if (error.code !== "23505") {
      console.error("submit_claim failed:", error.message);
    }
    if (uploaded.length) {
      await supabase.storage.from("claim-proofs").remove(uploaded);
    }
    return { error: claimWriteError(error.message, error.code) };
  }

  redirect(`${routes.my}?notice=claimed`);
}
