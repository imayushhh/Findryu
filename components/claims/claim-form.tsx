"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { submitClaim, type ClaimFormState } from "@/actions/claims";
import { controlClassName, describedBy, Field } from "@/components/items/field";
import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { maxProofFiles } from "@/lib/validations/claim";

const fieldOrder = ["hiddenDetailAnswer", "proofFiles", "proofNote", "contactPhone", "contactAddress"];

const answerHint =
  "For example, what is inside it, a mark or sticker, or a serial number. Staff compare this with a detail only they can see.";
const proofHint = `Photos of a receipt, a photo of you with the item, or a box label. JPEG or PNG, up to ${maxProofFiles} files.`;
const contactHint = "Staff use this only to reach you about this claim. Enter a phone number, an address, or both.";

export function ClaimForm({
  itemId,
  refCode,
  holdDays,
}: {
  itemId: string;
  refCode: string;
  holdDays: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [noProof, setNoProof] = useState(false);
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;

  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = fieldOrder.find((name) => errors[name]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
    }
  }

  function missingFields(formData: FormData) {
    const errors: Record<string, string> = {};
    const text = (name: string) => String(formData.get(name) ?? "").trim();
    if (!text("hiddenDetailAnswer")) {
      errors.hiddenDetailAnswer = "Describe something about the item that is not in the listing.";
    }
    if (noProof) {
      if (!text("contactPhone") && !text("contactAddress")) {
        errors.contactPhone = "Without proof, enter a phone number or a home address.";
      }
      return errors;
    }
    const files = formData.getAll("proofFiles").filter((entry) => entry instanceof File && entry.size > 0);
    if (files.length > maxProofFiles) {
      errors.proofFiles = `Add up to ${maxProofFiles} proof files.`;
    } else if (files.length === 0 && !text("proofNote")) {
      errors.proofFiles = "Add a proof file or a proof note, or tick No proof available.";
    }
    return errors;
  }

  async function submit(formData: FormData) {
    setError(undefined);
    setFieldErrors({});
    const missing = missingFields(formData);
    if (Object.keys(missing).length > 0) {
      showFieldErrors(missing);
      return;
    }

    if (!noProof) {
      const files = formData.getAll("proofFiles").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      formData.delete("proofFiles");
      try {
        for (const file of files) {
          formData.append("proofFiles", await preparePhoto(file));
        }
      } catch (caught) {
        showFieldErrors({
          proofFiles: caught instanceof Error ? caught.message : "A proof file could not be prepared.",
        });
        return;
      }
    }

    const result: ClaimFormState | undefined = await submitClaim(formData);
    setError(result?.error);
    showFieldErrors(result?.fieldErrors ?? {});
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => submit(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="ref" value={refCode} />
      <Field
        id={fieldId("hiddenDetailAnswer")}
        label="What can you tell us about this item that is not in the listing?"
        error={fieldErrors.hiddenDetailAnswer}
        hint={answerHint}
      >
        <textarea
          id={fieldId("hiddenDetailAnswer")}
          name="hiddenDetailAnswer"
          required
          rows={4}
          aria-invalid={fieldErrors.hiddenDetailAnswer ? true : undefined}
          aria-describedby={describedBy(fieldId("hiddenDetailAnswer"), fieldErrors.hiddenDetailAnswer, answerHint)}
          className={`${controlClassName(fieldErrors.hiddenDetailAnswer)} h-auto py-2`}
        />
      </Field>

      <div className="flex items-start gap-3">
        <input
          id={fieldId("noProof")}
          name="noProof"
          type="checkbox"
          checked={noProof}
          onChange={(event) => {
            setNoProof(event.target.checked);
            setFieldErrors({});
          }}
          className="mt-0.5 size-6 shrink-0 accent-primary"
        />
        <label htmlFor={fieldId("noProof")} className="font-medium">
          No proof available
        </label>
      </div>

      {noProof ? (
        <>
          <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm">
            Without proof, your claim is On Hold for {holdDays} {holdDays === 1 ? "day" : "days"} before staff
            can approve it. A claim with proof that arrives in that time is reviewed first.
          </p>
          <Field
            id={fieldId("contactPhone")}
            label="Phone number"
            error={fieldErrors.contactPhone}
            hint={contactHint}
          >
            <input
              id={fieldId("contactPhone")}
              name="contactPhone"
              type="tel"
              autoComplete="tel"
              aria-invalid={fieldErrors.contactPhone ? true : undefined}
              aria-describedby={describedBy(fieldId("contactPhone"), fieldErrors.contactPhone, contactHint)}
              className={controlClassName(fieldErrors.contactPhone)}
            />
          </Field>
          <Field id={fieldId("contactAddress")} label="Home address" error={fieldErrors.contactAddress}>
            <textarea
              id={fieldId("contactAddress")}
              name="contactAddress"
              rows={2}
              autoComplete="street-address"
              aria-invalid={fieldErrors.contactAddress ? true : undefined}
              aria-describedby={describedBy(fieldId("contactAddress"), fieldErrors.contactAddress)}
              className={`${controlClassName(fieldErrors.contactAddress)} h-auto py-2`}
            />
          </Field>
        </>
      ) : (
        <>
          <Field id={fieldId("proofFiles")} label="Proof of ownership" error={fieldErrors.proofFiles} hint={proofHint}>
            <input
              id={fieldId("proofFiles")}
              name="proofFiles"
              type="file"
              multiple
              accept="image/jpeg,image/png"
              aria-invalid={fieldErrors.proofFiles ? true : undefined}
              aria-describedby={describedBy(fieldId("proofFiles"), fieldErrors.proofFiles, proofHint)}
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </Field>
          <Field id={fieldId("proofNote")} label="Proof note (optional if you add a file)" error={fieldErrors.proofNote}>
            <textarea
              id={fieldId("proofNote")}
              name="proofNote"
              rows={3}
              aria-invalid={fieldErrors.proofNote ? true : undefined}
              aria-describedby={describedBy(fieldId("proofNote"), fieldErrors.proofNote)}
              className={`${controlClassName(fieldErrors.proofNote)} h-auto py-2`}
            />
          </Field>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
        {pending ? "Sending…" : "Send claim"}
      </Button>
    </form>
  );
}
