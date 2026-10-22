"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") === "fr" ? "fr" : "en";
  const jar = await cookies();
  jar.set("findryu-locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
