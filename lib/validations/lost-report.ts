import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");

export const lostReportSchema = z
  .object({
    categoryId: z.uuid("Choose a category."),
    description: z
      .string()
      .trim()
      .min(1, "Describe the item.")
      .max(500, "Keep the description under 500 characters."),
    buildingId: z.uuid("Choose the building where you lost it."),
    lostFrom: date,
    lostTo: date,
  })
  .refine((value) => value.lostFrom <= value.lostTo, {
    path: ["lostTo"],
    message: "The end date must be on or after the start date.",
  });

export type LostReportInput = z.infer<typeof lostReportSchema>;
