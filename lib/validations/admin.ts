import { z } from "zod";

export const appRoles = ["user", "staff", "admin"] as const;

export const roleChangeSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(appRoles, { error: "Choose a role." }),
    locationId: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.role === "staff" && !z.uuid().safeParse(value.locationId).success) {
      context.addIssue({
        code: "custom",
        path: ["locationId"],
        message: "Staff must be assigned to a desk.",
      });
    }
  });
