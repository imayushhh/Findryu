import type { ReactNode } from "react";

export function PageShell({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <div
        className={
          wide
            ? "mt-4 space-y-4 text-base leading-7"
            : "mt-4 max-w-2xl space-y-3 text-base leading-7"
        }
      >
        {children}
      </div>
    </div>
  );
}
