import type { ReactNode } from "react";

const controlClass =
  "border-input bg-background block h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function controlClassName(error?: string) {
  return error ? `${controlClass} border-destructive` : controlClass;
}

export function describedBy(id: string, error?: string, hint?: string) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}
