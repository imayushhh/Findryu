"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { logWalkInItem, reportFoundItem, type ItemFormState } from "@/actions/items";
import { controlClassName, describedBy, Field } from "@/components/items/field";
import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { specialHandlingNote, type SpecialHandling } from "@/lib/items/text";

export type Choice = { id: string; name: string };

export type CategoryChoice = Choice & { specialHandling: SpecialHandling };

const fieldOrder = [
  "categoryId",
  "description",
  "buildingId",
  "foundAt",
  "photo",
  "locationId",
  "hiddenDetail",
];

function localNowValue() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function FoundItemForm({
  mode,
  categories,
  buildings,
  locations,
  lockedLocation,
}: {
  mode: "report" | "intake";
  categories: CategoryChoice[];
  buildings: Choice[];
  locations: Choice[];
  lockedLocation?: Choice | null;
}) {
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [categoryId, setCategoryId] = useState("");
  const category = categories.find((item) => item.id === categoryId);
  const note = category ? specialHandlingNote(category.specialHandling) : null;

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
    if (!text("categoryId")) errors.categoryId = "Choose a category.";
    if (!text("description")) errors.description = "Describe the item.";
    if (!text("buildingId")) errors.buildingId = "Choose the building where it was found.";
    if (!text("foundAt")) errors.foundAt = "Enter the date and time it was found.";
    if (!text("locationId")) errors.locationId = "Choose a desk.";
    if (mode === "intake" && !text("hiddenDetail")) {
      errors.hiddenDetail = "Enter a hidden detail only the owner would know.";
    }
    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) errors.photo = "Add a photo.";
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

    let prepared: File;
    try {
      prepared = await preparePhoto(formData.get("photo") as File);
    } catch (caught) {
      showFieldErrors({
        photo: caught instanceof Error ? caught.message : "The photo could not be prepared.",
      });
      return;
    }

    formData.set("photo", prepared);
    const result: ItemFormState | undefined =
      mode === "intake" ? await logWalkInItem(formData) : await reportFoundItem(formData);
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
      <Field id={fieldId("categoryId")} label="Category" error={fieldErrors.categoryId}>
        <select
          id={fieldId("categoryId")}
          name="categoryId"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-invalid={fieldErrors.categoryId ? true : undefined}
          aria-describedby={describedBy(fieldId("categoryId"), fieldErrors.categoryId)}
          className={controlClassName(fieldErrors.categoryId)}
        >
          <option value="">Choose a category</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      {note ? (
        <p role="status" className="text-sm font-medium">
          {note}
        </p>
      ) : null}
      <Field id={fieldId("description")} label="Description" error={fieldErrors.description}>
        <textarea
          id={fieldId("description")}
          name="description"
          required
          rows={4}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={describedBy(fieldId("description"), fieldErrors.description)}
          className={`${controlClassName(fieldErrors.description)} h-auto py-2`}
        />
      </Field>
      <Field id={fieldId("buildingId")} label="Building where it was found" error={fieldErrors.buildingId}>
        <select
          id={fieldId("buildingId")}
          name="buildingId"
          required
          defaultValue=""
          aria-invalid={fieldErrors.buildingId ? true : undefined}
          aria-describedby={describedBy(fieldId("buildingId"), fieldErrors.buildingId)}
          className={controlClassName(fieldErrors.buildingId)}
        >
          <option value="">Choose a building</option>
          {buildings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={fieldId("foundAt")} label="Date and time found" error={fieldErrors.foundAt}>
        <input
          id={fieldId("foundAt")}
          name="foundAt"
          type="datetime-local"
          required
          onFocus={(event) => {
            event.currentTarget.max = localNowValue();
          }}
          aria-invalid={fieldErrors.foundAt ? true : undefined}
          aria-describedby={describedBy(fieldId("foundAt"), fieldErrors.foundAt)}
          className={controlClassName(fieldErrors.foundAt)}
        />
      </Field>
      <Field id={fieldId("photo")} label="Photo" error={fieldErrors.photo} hint="JPEG or PNG, up to 10 MB.">
        <input
          id={fieldId("photo")}
          name="photo"
          type="file"
          accept="image/jpeg,image/png"
          required
          aria-invalid={fieldErrors.photo ? true : undefined}
          aria-describedby={describedBy(fieldId("photo"), fieldErrors.photo, "JPEG or PNG, up to 10 MB.")}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </Field>
      {lockedLocation ? (
        <>
          <input type="hidden" name="locationId" value={lockedLocation.id} />
          <p>
            Desk: <span className="font-medium">{lockedLocation.name}</span>
          </p>
        </>
      ) : (
        <Field
          id={fieldId("locationId")}
          label={mode === "intake" ? "Desk receiving this item" : "Drop-off desk"}
          error={fieldErrors.locationId}
        >
          <select
            id={fieldId("locationId")}
            name="locationId"
            required
            defaultValue=""
            aria-invalid={fieldErrors.locationId ? true : undefined}
            aria-describedby={describedBy(fieldId("locationId"), fieldErrors.locationId)}
            className={controlClassName(fieldErrors.locationId)}
          >
            <option value="">Choose a desk</option>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {mode === "intake" ? (
        <Field
          id={fieldId("hiddenDetail")}
          label="Hidden detail"
          error={fieldErrors.hiddenDetail}
          hint="A serial number, the contents, or a mark that is not in the description. This is never shown publicly."
        >
          <textarea
            id={fieldId("hiddenDetail")}
            name="hiddenDetail"
            required
            rows={3}
            aria-invalid={fieldErrors.hiddenDetail ? true : undefined}
            aria-describedby={describedBy(fieldId("hiddenDetail"),
              fieldErrors.hiddenDetail,
              "A serial number, the contents, or a mark that is not in the description. This is never shown publicly.",
            )}
            className={`${controlClassName(fieldErrors.hiddenDetail)} h-auto py-2`}
          />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
        {pending ? "Saving…" : mode === "intake" ? "Log walk-in" : "Submit report"}
      </Button>
    </form>
  );
}
