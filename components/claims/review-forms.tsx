"use client";

import { useActionState, useId, useState, useTransition } from "react";

import {
  approveClaim,
  recordHandover,
  rejectClaim,
  reopenContested,
  revealHiddenDetail,
} from "@/actions/claim-review";
import { controlClassName, describedBy, Field } from "@/components/items/field";
import { SubmitButton } from "@/components/items/submit-button";
import { Button } from "@/components/ui/button";

function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

export function RevealHiddenDetail({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ detail?: string; error?: string }>();

  if (result?.detail) {
    return (
      <div role="status" className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">Hidden detail recorded by staff</p>
        <p className="mt-1 break-words">{result.detail}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="min-h-11 px-4"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await revealHiddenDetail(claimId)))}
      >
        {pending ? "Revealing…" : "Reveal hidden detail"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Read the claimant&apos;s answer first, then compare it with the hidden detail.
      </p>
      <FormError message={result?.error} />
    </div>
  );
}

export function ApproveForm({ claimId, blockedReason }: { claimId: string; blockedReason?: string }) {
  const [state, formAction] = useActionState(approveClaim, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claimId" value={claimId} />
      {blockedReason ? (
        <>
          <Button type="submit" size="lg" className="min-h-11 px-4" disabled aria-describedby={`${claimId}-blocked`}>
            Approve claim
          </Button>
          <p id={`${claimId}-blocked`} className="text-sm text-muted-foreground">
            {blockedReason}
          </p>
        </>
      ) : (
        <SubmitButton pendingLabel="Approving…">Approve claim</SubmitButton>
      )}
      <FormError message={state.error} />
    </form>
  );
}

export function RejectForm({ claimId }: { claimId: string }) {
  const [state, formAction] = useActionState(rejectClaim, {});
  const formId = useId();
  const reasonId = `${formId}-reason`;
  const hint = "The claimant sees this reason on their My items page.";

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <Field id={reasonId} label="Reason for rejecting" error={state.fieldErrors?.reason} hint={hint}>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          required
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
          aria-describedby={describedBy(reasonId, state.fieldErrors?.reason, hint)}
          className={`${controlClassName(state.fieldErrors?.reason)} h-auto py-2`}
        />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Rejecting…">Reject claim</SubmitButton>
    </form>
  );
}

export function HandoverForm({ claimId }: { claimId: string }) {
  const [state, formAction] = useActionState(recordHandover, {});
  const formId = useId();
  const checkId = `${formId}-photo-id`;
  const error = state.fieldErrors?.photoIdChecked;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <div className="flex items-start gap-3">
        <input
          id={checkId}
          name="photoIdChecked"
          type="checkbox"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${checkId}-error` : undefined}
          className="mt-0.5 size-6 shrink-0 accent-primary"
        />
        <label htmlFor={checkId} className="font-medium">
          Photo ID checked. The name matches the claimant.
        </label>
      </div>
      {error ? (
        <p id={`${checkId}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">Do not write down the ID number. FindrYU never stores it.</p>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Recording…">Hand over item</SubmitButton>
    </form>
  );
}

export function ReopenForm({ itemId }: { itemId: string }) {
  const [state, formAction] = useActionState(reopenContested, {});
  const formId = useId();
  const reasonId = `${formId}-reason`;
  const hint = "For example, another person showed stronger proof that the item is theirs.";

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <Field id={reasonId} label="Why is this item being reopened?" error={state.fieldErrors?.reason} hint={hint}>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          required
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
          aria-describedby={describedBy(reasonId, state.fieldErrors?.reason, hint)}
          className={`${controlClassName(state.fieldErrors?.reason)} h-auto py-2`}
        />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Reopening…">Reopen as contested</SubmitButton>
    </form>
  );
}
