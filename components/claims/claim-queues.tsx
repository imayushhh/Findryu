import Link from "next/link";

import { claimStatusLabel, isClaimStatus } from "@/lib/claims/text";
import { related } from "@/lib/items/text";
import { staffClaimPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

type QueueClaim = {
  id: string;
  item_id: string;
  status: string;
  created_at: string;
  hold_until: string | null;
  no_proof: boolean;
  pickup_request: string;
  items: { ref_code: string; description: string } | { ref_code: string; description: string }[] | null;
};

/** Claim lists for the staff dashboard. RLS limits staff to claims for items at their desk. */
export async function ClaimQueues() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, item_id, status, created_at, hold_until, no_proof, pickup_request, items(ref_code, description)")
    .in("status", ["pending", "on_hold", "approved"])
    .order("created_at", { ascending: true })
    .returns<QueueClaim[]>();

  if (error) {
    return <p>Claims could not be loaded. Refresh the page.</p>;
  }

  const claims = data ?? [];
  const openByItem = new Map<string, QueueClaim[]>();
  for (const claim of claims) {
    openByItem.set(claim.item_id, [...(openByItem.get(claim.item_id) ?? []), claim]);
  }
  const contestedItems = [...openByItem.values()].filter((group) => group.length > 1);
  const toDecide = claims.filter((claim) => claim.status === "pending" || claim.status === "on_hold");
  const toCollect = claims.filter((claim) => claim.status === "approved");

  return (
    <>
      {contestedItems.length > 0 ? (
        <section aria-labelledby="multiple-claims" className="space-y-3">
          <h2 id="multiple-claims" className="text-xl font-semibold tracking-tight">
            Items with more than one open claim
          </h2>
          <ul className="grid gap-3">
            {contestedItems.map((group) => {
              const item = related(group[0].items);
              return (
                <li key={group[0].item_id} className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <p className="font-semibold">
                    {item?.ref_code}: {group.length} open claims
                  </p>
                  {item ? <p className="break-words">{item.description}</p> : null}
                  <ul className="mt-1">
                    {group.map((claim) => (
                      <li key={claim.id}>
                        <Link href={staffClaimPath(claim.id)} className={textLinkClass}>
                          {isClaimStatus(claim.status) ? claimStatusLabel(claim.status) : claim.status}, sent{" "}
                          {formatToronto(claim.created_at)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="claims-queue" className="space-y-3">
        <h2 id="claims-queue" className="text-xl font-semibold tracking-tight">
          Claims to review
        </h2>
        {toDecide.length === 0 ? <p>No claims are waiting for a decision.</p> : null}
        <ul className="grid gap-3">
          {toDecide.map((claim) => {
            const item = related(claim.items);
            return (
              <li key={claim.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold">{item?.ref_code}</p>
                {item ? <p className="break-words">{item.description}</p> : null}
                <p className="text-sm text-muted-foreground">
                  {isClaimStatus(claim.status) ? claimStatusLabel(claim.status) : claim.status}
                  {claim.status === "on_hold" && claim.hold_until ? ` until ${formatToronto(claim.hold_until)}` : ""}
                  {" · "}
                  {claim.no_proof ? "No proof" : "With proof"} · Sent {formatToronto(claim.created_at)}
                </p>
                <p className="mt-2">
                  <Link href={staffClaimPath(claim.id)} className={textLinkClass}>
                    Review claim<span className="sr-only"> for {item?.ref_code}</span>
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="pickup-queue" className="space-y-3">
        <h2 id="pickup-queue" className="text-xl font-semibold tracking-tight">
          Approved, waiting for pickup
        </h2>
        {toCollect.length === 0 ? <p>No approved items are waiting for pickup.</p> : null}
        <ul className="grid gap-3">
          {toCollect.map((claim) => {
            const item = related(claim.items);
            return (
              <li key={claim.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold">{item?.ref_code}</p>
                {item ? <p className="break-words">{item.description}</p> : null}
                {claim.pickup_request === "security_services" ? (
                  <p className="text-sm font-medium">After-hours pickup: transfer to Security Services.</p>
                ) : null}
                <p className="mt-2">
                  <Link href={staffClaimPath(claim.id)} className={textLinkClass}>
                    Hand over<span className="sr-only"> {item?.ref_code}</span>
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
