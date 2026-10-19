import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import {
  ApproveForm,
  HandoverForm,
  RejectForm,
  RevealHiddenDetail,
} from "@/components/claims/review-forms";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { claimStatusLabel, isClaimStatus } from "@/lib/claims/text";
import { signedUrls } from "@/lib/items/photos";
import { deskPlace, related } from "@/lib/items/text";
import { routes, staffClaimPath, staffItemPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

export const metadata = {
  title: "Review claim",
};

const notices: Record<string, string> = {
  approved: "Claim approved. The owner can now pick the item up with photo ID.",
  rejected: "Claim rejected. The owner sees the reason on their My items page.",
  collected: "Handover recorded. The item and the claim are now collected.",
};

const openStatuses = ["pending", "on_hold", "approved"];

export default function ReviewClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  return (
    <PageShell title="Review claim">
      <Suspense fallback={<p>Loading the claim…</p>}>
        <ReviewPanel params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function daysLeft(until: string) {
  return Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000));
}

async function ReviewPanel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(staffClaimPath(id))}`);
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select(
      "id, item_id, status, hidden_detail_answer, proof_note, no_proof, contact_phone, contact_address, hold_until, rejection_reason, pickup_request, created_at, decided_at, claimant:profiles!claims_claimant_id_fkey(email, full_name), items(id, ref_code, description, status, current_location_id, categories(name), buildings(name), current:locations!items_current_location_id_fkey(name, kind, building, room)), claim_proofs(storage_path)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!claim || !isClaimStatus(claim.status)) {
    notFound();
  }

  const item = related(claim.items);
  const claimant = related(claim.claimant);
  const desk = related(item?.current ?? null);
  const status = claim.status;

  const [others, holdSetting, handover, proofUrls] = await Promise.all([
    supabase
      .from("claims")
      .select("id, status, created_at, no_proof")
      .eq("item_id", claim.item_id)
      .in("status", openStatuses)
      .neq("id", claim.id)
      .order("created_at"),
    supabase.from("settings").select("value").eq("key", "no_proof_hold_days").maybeSingle(),
    supabase
      .from("handovers")
      .select("collected_at, staff:profiles!handovers_staff_id_fkey(email), location:locations(name)")
      .eq("claim_id", claim.id)
      .maybeSingle(),
    signedUrls(
      "claim-proofs",
      (claim.claim_proofs ?? []).map((proof) => proof.storage_path),
    ),
  ]);

  const otherOpen = others.data ?? [];
  const holdDays = Number.parseInt(holdSetting.data?.value ?? "7", 10);
  const onHold =
    status === "on_hold" && claim.hold_until && holdDays > 0 && isFuture(claim.hold_until);
  const atThisDesk = profile.role === "admin" || item?.current_location_id === profile.locationId;
  const decidable = status === "pending" || status === "on_hold";
  const itemAtDesk = item?.status === "received" || item?.status === "contested";
  const needsSecurity = claim.pickup_request === "security_services" && desk?.kind !== "security";
  const handoverRow = handover.data;

  return (
    <>
      {notice && notices[notice] ? (
        <p role="status" className="rounded-lg border border-border bg-card p-4">
          {notices[notice]}
        </p>
      ) : null}

      {otherOpen.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="font-semibold">
            This item has {otherOpen.length + 1} open claims. Compare them before approving.
          </p>
          <ul className="mt-2 space-y-1">
            {otherOpen.map((other) => (
              <li key={other.id}>
                <Link href={staffClaimPath(other.id)} className={textLinkClass}>
                  {isClaimStatus(other.status) ? claimStatusLabel(other.status) : other.status} claim from{" "}
                  {formatToronto(other.created_at)}
                  {other.no_proof ? " (no proof)" : " (with proof)"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item ? (
        <p>
          <Link href={staffItemPath(item.id)} className={textLinkClass}>
            {item.ref_code}
          </Link>{" "}
          {item.description}
          <span className="block text-sm text-muted-foreground">
            {[related(item.categories)?.name, related(item.buildings)?.name, desk ? `now at ${deskPlace(desk)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      ) : null}

      <p>
        Status: <span className="font-medium">{claimStatusLabel(status)}</span>. Sent{" "}
        {formatToronto(claim.created_at)} by {claimant?.email ?? "an unknown account"}
        {claimant?.full_name ? ` (${claimant.full_name})` : ""}.
      </p>

      <section aria-labelledby="claimant-answer" className="space-y-2">
        <h2 id="claimant-answer" className="text-xl font-semibold tracking-tight">
          The claimant&apos;s answer
        </h2>
        <p className="break-words rounded-lg border border-border p-4">{claim.hidden_detail_answer}</p>
        {claim.proof_note ? (
          <>
            <h3 className="font-semibold">Proof note</h3>
            <p className="break-words rounded-lg border border-border p-4">{claim.proof_note}</p>
          </>
        ) : null}
        {claim.no_proof ? (
          <p>
            No proof available. Contact:{" "}
            {[claim.contact_phone, claim.contact_address].filter(Boolean).join(" · ") || "not recorded"}
          </p>
        ) : null}
      </section>

      {atThisDesk ? (
        <section aria-labelledby="hidden-detail" className="space-y-2">
          <h2 id="hidden-detail" className="text-xl font-semibold tracking-tight">
            Hidden detail
          </h2>
          <RevealHiddenDetail claimId={claim.id} />
        </section>
      ) : null}

      {(claim.claim_proofs ?? []).length > 0 ? (
        <section aria-labelledby="proof-files" className="space-y-2">
          <h2 id="proof-files" className="text-xl font-semibold tracking-tight">
            Proof files
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(claim.claim_proofs ?? []).map((proof, index) => {
              const url = proofUrls.get(proof.storage_path);
              return (
                <li key={proof.storage_path}>
                  {url ? (
                    // Signed URLs expire quickly, so the browser must not reuse a cached copy.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Proof file ${index + 1} from the claimant`}
                      className="w-full rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <p>Proof file {index + 1} could not be loaded.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {status === "on_hold" && claim.hold_until ? (
        <p className="rounded-lg border border-border bg-card p-4">
          {onHold
            ? `On hold until ${formatToronto(claim.hold_until)}. ${daysLeft(claim.hold_until)} ${daysLeft(claim.hold_until) === 1 ? "day" : "days"} left.`
            : `The hold ended on ${formatToronto(claim.hold_until)}. You can approve this claim now.`}
        </p>
      ) : null}

      {status === "rejected" && claim.rejection_reason ? <p>Reason: {claim.rejection_reason}</p> : null}

      {!atThisDesk ? (
        <p>This item is at another desk. Only staff at that desk can decide this claim.</p>
      ) : null}

      {atThisDesk && decidable ? (
        <section aria-labelledby="decision" className="space-y-4">
          <h2 id="decision" className="text-xl font-semibold tracking-tight">
            Decision
          </h2>
          <ApproveForm
            claimId={claim.id}
            blockedReason={
              onHold && claim.hold_until
                ? `Approve is available after ${formatToronto(claim.hold_until)}, when the no-proof hold ends.`
                : undefined
            }
          />
          <RejectForm claimId={claim.id} />
        </section>
      ) : null}

      {atThisDesk && status === "approved" ? (
        <section aria-labelledby="handover" className="space-y-3">
          <h2 id="handover" className="text-xl font-semibold tracking-tight">
            Handover
          </h2>
          {needsSecurity ? (
            <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4 font-medium">
              The owner asked for after-hours pickup. Transfer the item to Security Services first, from the{" "}
              <Link href={staffItemPath(claim.item_id)} className="underline underline-offset-4">
                item page
              </Link>
              .
            </p>
          ) : itemAtDesk ? (
            <HandoverForm claimId={claim.id} />
          ) : (
            <p>The item is moving between desks. Mark it as arrived on the item page, then hand it over.</p>
          )}
          <details className="rounded-lg border border-border p-4">
            <summary className="min-h-11 cursor-pointer content-center font-medium">
              Reject this approved claim instead
            </summary>
            <div className="mt-3">
              <RejectForm claimId={claim.id} />
            </div>
          </details>
        </section>
      ) : null}

      {handoverRow ? (
        <p className="rounded-lg border border-border bg-card p-4">
          Collected {formatToronto(handoverRow.collected_at)} at {related(handoverRow.location)?.name ?? "the desk"}.
          Photo ID checked by {related(handoverRow.staff)?.email ?? "staff"}.
        </p>
      ) : null}

      <p>
        <Link href={routes.staff} className={textLinkClass}>
          Back to the desk
        </Link>
      </p>
    </>
  );
}

function isFuture(timestamp: string) {
  return new Date(timestamp).getTime() > Date.now();
}
