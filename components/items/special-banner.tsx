import { specialHandlingBanner } from "@/lib/items/text";

export function SpecialBanner({ handling }: { handling: string }) {
  const message = specialHandlingBanner(handling);
  if (!message) {
    return null;
  }

  return (
    <p
      role="status"
      className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium"
    >
      {message}
    </p>
  );
}
