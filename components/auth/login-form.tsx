"use client";

import { useActionState, useState } from "react";

import { approveSignIn, verifySignInCode, type SignInState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { signInDeliveryError } from "@/lib/validations/auth";

const initialState: SignInState = {};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [codeState, codeAction, codePending] = useActionState(
    verifySignInCode,
    initialState,
  );
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | undefined>(initialError);
  const [sending, setSending] = useState(false);

  const email = sentTo ?? codeState.email;
  const sent = Boolean(sentTo) || codeState.sent;
  const error = sent ? (codeState.error ?? sendError) : sendError;
  const pending = sending;
  const errorId = "sign-in-error";

  async function sendLink(formData: FormData) {
    setSendError(undefined);
    setSending(true);
    const result = await approveSignIn(initialState, formData);
    if (result.error || !result.email) {
      setSendError(result.error ?? "Enter your York email.");
      setSending(false);
      return;
    }

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: result.email,
      options: {
        shouldCreateUser: true,
      },
    });

    setSending(false);
    if (otpError) {
      setSendError(signInDeliveryError(otpError.message));
      return;
    }
    setSentTo(result.email);
  }

  if (sent && email) {
    return (
      <div className="space-y-4">
        <p role="status">
          Check the inbox and spam folder for <span className="font-medium">{email}</span>.
          Open the link, then click Continue. If the message shows a code, enter
          it below instead.
        </p>
        <form action={codeAction} className="space-y-4" noValidate>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Sign-in code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {error ? (
            <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="min-h-11 px-4" disabled={codePending}>
            {codePending ? "Checking code…" : "Confirm code"}
          </Button>
        </form>
        <p>
          <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Use a different email
          </a>
        </p>
      </div>
    );
  }

  return (
    <form action={sendLink} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          York email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : "email-hint"}
          className="border-input bg-background h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id="email-hint" className="text-sm text-muted-foreground">
          Ends with @yorku.ca or @my.yorku.ca.
        </p>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
        {pending ? "Sending email…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
