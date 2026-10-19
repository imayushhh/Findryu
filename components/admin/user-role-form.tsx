"use client";

import { useActionState, useId, useState } from "react";

import { updateUserRole } from "@/actions/admin";
import { controlClassName } from "@/components/items/field";
import { SubmitButton } from "@/components/items/submit-button";
import type { AppRole } from "@/lib/auth";

const roleLabels: Record<AppRole, string> = {
  user: "User",
  staff: "Staff",
  admin: "Admin",
};

export function UserRoleForm({
  userId,
  email,
  role,
  locationId,
  desks,
  isSelf,
}: {
  userId: string;
  email: string;
  role: AppRole;
  locationId: string | null;
  desks: { id: string; name: string }[];
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(updateUserRole, {});
  const [chosenRole, setChosenRole] = useState<AppRole>(role);
  const formId = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-2">
        <label htmlFor={`${formId}-role`} className="text-sm font-medium">
          Role
        </label>
        <select
          id={`${formId}-role`}
          name="role"
          value={chosenRole}
          onChange={(event) => setChosenRole(event.target.value as AppRole)}
          disabled={isSelf}
          aria-describedby={isSelf ? `${formId}-self` : undefined}
          className={controlClassName()}
        >
          {(Object.keys(roleLabels) as AppRole[]).map((value) => (
            <option key={value} value={value}>
              {roleLabels[value]}
            </option>
          ))}
        </select>
        {isSelf ? <input type="hidden" name="role" value="admin" /> : null}
      </div>
      <div className="space-y-2">
        <label htmlFor={`${formId}-desk`} className="text-sm font-medium">
          Desk
        </label>
        <select
          id={`${formId}-desk`}
          name="locationId"
          defaultValue={locationId ?? ""}
          disabled={chosenRole !== "staff"}
          className={controlClassName()}
        >
          <option value="">{chosenRole === "staff" ? "Choose a desk" : "Not needed for this role"}</option>
          {desks.map((desk) => (
            <option key={desk.id} value={desk.id}>
              {desk.name}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingLabel="Saving…">
        Save<span className="sr-only"> for {email}</span>
      </SubmitButton>
      {isSelf ? (
        <p id={`${formId}-self`} className="text-sm text-muted-foreground sm:col-span-3">
          This is you. Another admin must change your role.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive sm:col-span-3">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-medium sm:col-span-3">
          {state.saved}
        </p>
      ) : null}
    </form>
  );
}
