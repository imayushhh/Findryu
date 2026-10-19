import { z } from "zod";

export const maxProofFiles = 3;

const phonePattern = /^[0-9+()\-.\s]{7,30}$/;

export const claimSchema = z
  .object({
    itemId: z.uuid({ error: "This item could not be found." }),
    hiddenDetailAnswer: z
      .string()
      .trim()
      .min(1, "Describe something about the item that is not in the listing.")
      .max(1000, "Keep the description under 1000 characters."),
    noProof: z.boolean(),
    proofNote: z.string().trim().max(2000, "Keep the proof note under 2000 characters."),
    contactPhone: z.string().trim().max(30, "Enter a shorter phone number."),
    contactAddress: z.string().trim().max(300, "Keep the address under 300 characters."),
  })
  .superRefine((value, context) => {
    if (!value.noProof) {
      return;
    }
    if (!value.contactPhone && !value.contactAddress) {
      context.addIssue({
        code: "custom",
        path: ["contactPhone"],
        message: "Without proof, enter a phone number or a home address.",
      });
    }
    if (value.contactPhone && !phonePattern.test(value.contactPhone)) {
      context.addIssue({
        code: "custom",
        path: ["contactPhone"],
        message: "Enter a phone number using digits, spaces, or + ( ) -.",
      });
    }
  });

export function claimWriteError(message: string, code?: string) {
  if (code === "23505") {
    return "You have already claimed this item. Check its status on My items.";
  }
  if (message.includes("submit_claim")) {
    return "Claims are not set up yet. Run supabase/migrations/010_claims.sql in the Supabase SQL Editor.";
  }
  if (message.includes("only allowed for items that have been received")) {
    return "This item can no longer be claimed.";
  }
  if (message.includes("Add proof of ownership")) {
    return "Add proof of ownership, or tick No proof available.";
  }
  if (message.includes("phone number or home address")) {
    return "Without proof, enter a phone number or a home address.";
  }
  return "The claim could not be sent. Check the form and try again.";
}
