"use client";

import { useActionState, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";

import type { CatalogFormState } from "@/actions/catalog";
import { archiveItem, restoreItem, runPrivacyCleanup, type ExpiryFormState } from "@/actions/expiry";
import { controlClassName } from "@/components/items/field";
import { SubmitButton } from "@/components/items/submit-button";
import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/images/prepare-photo";

function Result({ state }: { state: { error?: string; saved?: string } }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="text-sm font-medium">
      {state.saved}
    </p>
  ) : null;
}

/** Wraps server-rendered fields with a server action and its result message. */
export function AdminForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  className,
  children,
}: {
  action: (state: CatalogFormState, formData: FormData) => Promise<CatalogFormState>;
  submitLabel: ReactNode;
  pendingLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "space-y-3"} noValidate>
      {children}
      <div className="space-y-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  );
}

export function ArchiveForm({ itemId }: { itemId: string }) {
  const [state, formAction] = useActionState(archiveItem, {});
  const id = useId();
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What happens to the item?</legend>
        {(
          [
            ["donated", "Donated"],
            ["disposed", "Disposed"],
          ] as const
        ).map(([value, label]) => (
          <div key={value} className="flex items-center gap-3">
            <input id={`${id}-${value}`} type="radio" name="outcome" value={value} className="size-6 accent-primary" />
            <label htmlFor={`${id}-${value}`}>{label}</label>
          </div>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Archiving deletes the item&apos;s photos, closes open claims, and hides it from search. An admin can restore it.
      </p>
      <Result state={state} />
      <SubmitButton pendingLabel="Archiving…">Archive item</SubmitButton>
    </form>
  );
}

export function RestoreForm({ itemId, refCode }: { itemId: string; refCode: string }) {
  const [state, formAction] = useActionState(restoreItem, {});
  const [pending, startTransition] = useTransition();
  const [photoError, setPhotoError] = useState<string>();
  const id = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("photo");
    setPhotoError(undefined);
    startTransition(async () => {
      if (!(file instanceof File) || file.size === 0) {
        setPhotoError("Add a new photo. The old photos were deleted when the item was archived.");
        return;
      }
      try {
        formData.set("photo", await preparePhoto(file));
      } catch (caught) {
        setPhotoError(caught instanceof Error ? caught.message : "The photo could not be prepared.");
        return;
      }
      startTransition(() => formAction(formData));
    });
  }

  const error = photoError ?? state.error;
  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={`${id}-photo`} className="text-sm font-medium">
        New photo for {refCode}
      </label>
      <input
        id={`${id}-photo`}
        name="photo"
        type="file"
        accept="image/jpeg,image/png"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${controlClassName(error)} py-2`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
        {pending ? "Restoring…" : "Restore item"}
      </Button>
    </form>
  );
}

export function PrivacyCleanupButton() {
  const [state, formAction] = useActionState<ExpiryFormState>(runPrivacyCleanup, {});
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton pendingLabel="Running cleanup…">Run privacy cleanup</SubmitButton>
      <Result state={state} />
    </form>
  );
}
