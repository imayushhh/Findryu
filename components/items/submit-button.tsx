"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="min-h-11 px-4" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
