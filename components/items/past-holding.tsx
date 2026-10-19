import Link from "next/link";

import { related } from "@/lib/items/text";
import { staffItemPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

export function holdingCutoff(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function isPastHolding(receivedAt: string, days: number) {
  return new Date(receivedAt).getTime() < Date.now() - days * 86400000;
}

export async function holdingPeriodDays() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "holding_period_days").maybeSingle();
  const days = Number.parseInt(data?.value ?? "30", 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
}

/** Received items older than the holding period. Staff see their own desk; admins see every desk. */
export async function PastHoldingPeriod({ locationId }: { locationId: string | null }) {
  const days = await holdingPeriodDays();
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, ref_code, description, received_at, categories(name), current:locations!items_current_location_id_fkey(name)")
    .eq("status", "received")
    .lt("received_at", holdingCutoff(days))
    .order("received_at", { ascending: true })
    .limit(100);
  if (locationId) {
    query = query.eq("current_location_id", locationId);
  }
  const { data, error } = await query;

  return (
    <section aria-labelledby="past-holding" className="space-y-3">
      <h2 id="past-holding" className="text-xl font-semibold tracking-tight">
        Past holding period
      </h2>
      <p className="text-sm text-muted-foreground">Received more than {days} days ago and not collected.</p>
      {error ? <p>This list could not be loaded.</p> : null}
      {!error && (data ?? []).length === 0 ? <p>No items are past the holding period.</p> : null}
      <ul className="grid gap-3">
        {(data ?? []).map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{item.ref_code}</p>
            <p className="break-words">{item.description}</p>
            <p className="text-sm text-muted-foreground">
              {[related(item.categories)?.name, related(item.current)?.name, item.received_at ? `received ${formatToronto(item.received_at)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-2">
              <Link href={staffItemPath(item.id)} className={textLinkClass}>
                Archive or keep<span className="sr-only"> {item.ref_code}</span>
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
