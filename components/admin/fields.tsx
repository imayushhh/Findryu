import { controlClassName } from "@/components/items/field";

export function TextField({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  hint,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: "text" | "number";
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        defaultValue={defaultValue ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={controlClassName()}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={controlClassName()}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="size-6 shrink-0 accent-primary" />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
