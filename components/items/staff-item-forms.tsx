"use client";

import { useActionState, useId } from "react";

import {
  markTransferArrived,
  receiveItem,
  transferItem,
  updateHiddenDetail,
} from "@/actions/items";
import { controlClassName, describedBy, Field } from "@/components/items/field";
import { SubmitButton } from "@/components/items/submit-button";
import type { TransferReason } from "@/lib/items/text";

const reasons: { value: TransferReason; label: string }[] = [
  { value: "routine", label: "Routine" },
  { value: "yu_card_office", label: "YU Card Office" },
  { value: "security_services", label: "Security Services" },
];

function useFieldId() {
  const formId = useId();
  return (name: string) => `${formId}-${name}`;
}

export function ReceiveForm({ itemId }: { itemId: string }) {
  const [state, formAction] = useActionState(receiveItem, {});
  const fieldId = useFieldId();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <Field
        id={fieldId("hiddenDetail")}
        label="Hidden detail"
        error={state?.fieldErrors?.hiddenDetail}
        hint="A serial number, the contents, or a mark that is not in the public description."
      >
        <textarea
          id={fieldId("hiddenDetail")}
          name="hiddenDetail"
          required
          rows={3}
          aria-invalid={state?.fieldErrors?.hiddenDetail ? true : undefined}
          aria-describedby={describedBy(fieldId("hiddenDetail"),
            state?.fieldErrors?.hiddenDetail,
            "A serial number, the contents, or a mark that is not in the public description.",
          )}
          className={`${controlClassName(state?.fieldErrors?.hiddenDetail)} h-auto py-2`}
        />
      </Field>
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Receiving…">Mark received</SubmitButton>
    </form>
  );
}

export function HiddenDetailForm({
  itemId,
  currentDetail,
}: {
  itemId: string;
  currentDetail: string;
}) {
  const [state, formAction] = useActionState(updateHiddenDetail, {});
  const fieldId = useFieldId();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <Field
        id={fieldId("hiddenDetail")}
        label="Hidden detail"
        error={state.fieldErrors?.hiddenDetail}
        hint="Only staff at this desk can see this. It is never listed publicly."
      >
        <textarea
          id={fieldId("hiddenDetail")}
          name="hiddenDetail"
          required
          rows={3}
          defaultValue={currentDetail}
          aria-invalid={state.fieldErrors?.hiddenDetail ? true : undefined}
          aria-describedby={describedBy(fieldId("hiddenDetail"),
            state.fieldErrors?.hiddenDetail,
            "Only staff at this desk can see this. It is never listed publicly.",
          )}
          className={`${controlClassName(state.fieldErrors?.hiddenDetail)} h-auto py-2`}
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Save hidden detail</SubmitButton>
    </form>
  );
}

export function TransferForm({
  itemId,
  locations,
  defaultLocationId,
  defaultReason,
}: {
  itemId: string;
  locations: { id: string; name: string }[];
  defaultLocationId?: string;
  defaultReason: TransferReason;
}) {
  const [state, formAction] = useActionState(transferItem, {});
  const fieldId = useFieldId();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <Field id={fieldId("toLocationId")} label="Send to" error={state.fieldErrors?.toLocationId}>
        <select
          id={fieldId("toLocationId")}
          name="toLocationId"
          required
          defaultValue={defaultLocationId ?? ""}
          aria-invalid={state.fieldErrors?.toLocationId ? true : undefined}
          aria-describedby={describedBy(fieldId("toLocationId"), state.fieldErrors?.toLocationId)}
          className={controlClassName(state.fieldErrors?.toLocationId)}
        >
          <option value="">Choose a desk</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={fieldId("reason")} label="Reason">
        <select
          id={fieldId("reason")}
          name="reason"
          required
          defaultValue={defaultReason}
          className={controlClassName()}
        >
          {reasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Transferring…">Record transfer</SubmitButton>
    </form>
  );
}

export function ArriveForm({ itemId }: { itemId: string }) {
  return (
    <form action={markTransferArrived}>
      <input type="hidden" name="itemId" value={itemId} />
      <SubmitButton pendingLabel="Saving…">Mark arrived</SubmitButton>
    </form>
  );
}
