import { z } from "zod";

const yorkDomains = new Set(["yorku.ca", "my.yorku.ca"]);

export const yorkEmailMessage =
  "Use a York email ending in @yorku.ca or @my.yorku.ca.";

export function isYorkEmail(email: string) {
  const domain = email.split("@")[1];
  return yorkDomains.has(domain ?? "");
}

export const yorkEmailSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your email address." })
  .pipe(
    z.email({ error: "Enter a valid email address." }).transform((value) => value.toLowerCase()),
  )
  .refine(isYorkEmail, { error: yorkEmailMessage });

export function signInDeliveryError(message: string) {
  const detail = message.toLowerCase();

  if (detail.includes("redirect")) {
    return "Supabase rejected the return address for the sign-in email. In Authentication, then URL Configuration, set Site URL to http://localhost:3000 and add http://localhost:3000/** under Redirect URLs.";
  }

  if (detail.includes("not authorized")) {
    return "Supabase did not send the email. Its built-in sender only delivers to addresses on this project's team. Add this York email under Organization, then Team, and try again.";
  }

  if (detail.includes("rate limit")) {
    return "Supabase is limiting sign-in emails. Wait a few minutes, then try again.";
  }

  if (detail.includes("sending") || detail.includes("smtp") || detail.includes("mail")) {
    return "Resend refused this email. In Supabase SMTP settings use host smtp.resend.com, port 465, username resend, password your API key, and sender onboarding@resend.dev. That sender only delivers to the email on your Resend account.";
  }

  return `The sign-in email could not be sent. ${message}`;
}

export const signInCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,8}$/, {
    error: "Enter the code from the sign-in email.",
  });
