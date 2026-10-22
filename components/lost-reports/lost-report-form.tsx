"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { saveLostReport } from "@/actions/lost-reports";
import { controlClassName, describedBy, Field } from "@/components/items/field";
import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/images/prepare-photo";

type Choice = { id: string; name: string };

export type LostReportValues = {
  id: string;
  categoryId: string;
  description: string;
  buildingId: string;
  lostFrom: string;
  lostTo: string;
  hasPhoto: boolean;
};

const fieldOrder = ["categoryId", "description", "buildingId", "lostFrom", "lostTo", "photo"];
const photoHint = "Optional. JPEG or PNG, up to 10 MB. Only you and staff can see it.";

export function LostReportForm({
  categories,
  buildings,
  today,
  report,
}: {
  categories: Choice[];
  buildings: Choice[];
  today: string;
  report?: LostReportValues;
}) {
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = fieldOrder.find((name) => errors[name]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
    }
  }

  async function submit(formData: FormData) {
    setError(undefined);
    const text = (name: string) => String(formData.get(name) ?? "").trim();
    const missing: Record<string, string> = {};
    if (!text("categoryId")) missing.categoryId = "Choose a category.";
    if (!text("description")) missing.description = "Describe the item.";
    if (!text("buildingId")) missing.buildingId = "Choose the building where you lost it.";
    if (!text("lostFrom")) missing.lostFrom = "Enter the first day it could have been lost.";
    if (!text("lostTo")) missing.lostTo = "Enter the last day it could have been lost.";
    if (Object.keys(missing).length > 0) {
      showFieldErrors(missing);
      return;
    }

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      try {
        formData.set("photo", await preparePhoto(photo));
      } catch (caught) {
        showFieldErrors({ photo: caught instanceof Error ? caught.message : "The photo could not be prepared." });
        return;
      }
    } else {
      formData.delete("photo");
    }

    const result = await saveLostReport(formData);
    setError(result?.error);
    showFieldErrors(result?.fieldErrors ?? {});
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => submit(formData));
  }

  const select = (name: "categoryId" | "buildingId", label: string, placeholder: string, options: Choice[]) => (
    <Field id={fieldId(name)} label={label} error={fieldErrors[name]}>
      <select
        id={fieldId(name)}
        name={name}
        required
        defaultValue={report?.[name] ?? ""}
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={describedBy(fieldId(name), fieldErrors[name])}
        className={controlClassName(fieldErrors[name])}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );

  const dateField = (name: "lostFrom" | "lostTo", label: string) => (
    <Field id={fieldId(name)} label={label} error={fieldErrors[name]}>
      <input
        id={fieldId(name)}
        name={name}
        type="date"
        required
        max={today}
        defaultValue={report?.[name] ?? ""}
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={describedBy(fieldId(name), fieldErrors[name])}
        className={controlClassName(fieldErrors[name])}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={report?.id ?? ""} />
      {select("categoryId", "Category", "Choose a category", categories)}
      <Field id={fieldId("description")} label="Description" error={fieldErrors.description}>
        <textarea
          id={fieldId("description")}
          name="description"
          required
          rows={4}
          defaultValue={report?.description}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={describedBy(fieldId("description"), fieldErrors.description)}
          className={`${controlClassName(fieldErrors.description)} h-auto py-2`}
        />
      </Field>
      {select("buildingId", "Building where you lost it", "Choose a building", buildings)}
      <div className="grid gap-4 sm:grid-cols-2">
        {dateField("lostFrom", "Lost on or after")}
        {dateField("lostTo", "Lost on or before")}
      </div>
      <Field
        id={fieldId("photo")}
        label={report?.hasPhoto ? "Replace the photo" : "Photo"}
        error={fieldErrors.photo}
        hint={photoHint}
      >
        <input
          id={fieldId("photo")}
          name="photo"
          type="file"
          accept="image/jpeg,image/png"
          aria-invalid={fieldErrors.photo ? true : undefined}
          aria-describedby={describedBy(fieldId("photo"), fieldErrors.photo, photoHint)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
        {pending ? "Saving…" : report ? "Save changes" : "Register lost item"}
      </Button>
    </form>
  );
}
