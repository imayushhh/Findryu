import { z } from "zod";

const uuid = z.uuid({ error: "Choose a valid option." });

export const foundItemSchema = z.object({
  categoryId: uuid,
  description: z
    .string()
    .trim()
    .min(1, { error: "Describe the item." })
    .max(2000, { error: "Use 2000 characters or fewer." }),
  buildingId: uuid,
  foundAt: z.string().trim().min(1, { error: "Enter the date and time it was found." }),
  locationId: uuid,
});

export const hiddenDetailSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a hidden detail only the owner would know." })
  .max(500, { error: "Use 500 characters or fewer." });

export const transferSchema = z.object({
  itemId: uuid,
  toLocationId: uuid,
  reason: z.enum(["routine", "yu_card_office", "security_services"], {
    error: "Choose a transfer reason.",
  }),
});

export function fieldErrorsFrom(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function itemWriteError(message: string) {
  const detail = message.toLowerCase();
  if (detail.includes("report_found_item") || detail.includes("log_walk_in_item")) {
    return "The database is missing migration 007. Run supabase/migrations/007_item_rpcs.sql in the Supabase SQL Editor.";
  }
  if (detail.includes("at least one photo")) {
    return "Add a photo of the item.";
  }
  if (detail.includes("drop-off")) {
    return "Choose an active drop-off desk.";
  }
  if (detail.includes("row-level") || detail.includes("permission") || detail.includes("not allowed")) {
    return "You cannot change this item.";
  }
  return "The item could not be saved. Check the form and try again.";
}
