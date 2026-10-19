"use server";

import { redirect } from "next/navigation";

import type { EmailOtpType } from "@supabase/supabase-js";

import { routes, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { signInCodeSchema, yorkEmailSchema } from "@/lib/validations/auth";

export type SignInState = {
  error?: string;
  email?: string;
  sent?: boolean;
};

/** Checks the York domain. The browser sends the email so the sign-in cookie stays in that browser. */
export async function approveSignIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = yorkEmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your York email." };
  }

  return { email: parsed.data };
}

export async function completeSignIn(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const code = String(formData.get("code") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "email") as EmailOtpType;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(`${routes.login}?error=link`);
    }
    redirect(next);
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      redirect(`${routes.login}?error=link`);
    }
    redirect(next);
  }

  redirect(`${routes.login}?error=link`);
}

export async function verifySignInCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = yorkEmailSchema.safeParse(formData.get("email"));
  const token = signInCodeSchema.safeParse(formData.get("token"));
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email.success) {
    return {
      error: email.error.issues[0]?.message ?? "Enter your York email.",
      sent: true,
    };
  }

  if (!token.success) {
    return {
      error: token.error.issues[0]?.message ?? "Enter the code from the email.",
      sent: true,
      email: email.data,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: token.data,
    type: "email",
  });

  if (error) {
    return {
      error: "That code is not valid or it has expired. Request a new email.",
      sent: true,
      email: email.data,
    };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(routes.home);
}
