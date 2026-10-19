import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ClaimForm } from "@/components/claims/claim-form";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { claimStatusLabel, isClaimStatus } from "@/lib/claims/text";
import { related } from "@/lib/items/text";
import { itemClaimPath, itemPath, routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

export const metadata = {
  title: "Claim",
};

export default function ClaimPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <PageShell title="Claim this item">
      <Suspense fallback={<p>Loading the claim form…</p>}>
        <ClaimPanel params={params} />
      </Suspense>
    </PageShell>
  );
}

async function ClaimPanel({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!/^FYU-\d{6}$/.test(ref)) {
    notFound();
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(itemClaimPath(ref))}`);
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, ref_code, description, status, categories(name), buildings(name)")
    .eq("ref_code", ref)
    .in("status", ["received", "in_transit"])
    .maybeSingle();
  if (!item) {
    notFound();
  }

  const [existing, holdSetting] = await Promise.all([
    supabase
      .from("claims")
      .select("status, hold_until, created_at")
      .eq("item_id", item.id)
      .eq("claimant_id", profile.id)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "no_proof_hold_days").maybeSingle(),
  ]);
  const holdDays = Number.parseInt(holdSetting.data?.value ?? "7", 10);

  const summary = (
    <p>
      <span className="font-medium">{item.ref_code}</span>: {item.description}{" "}
      <span className="text-muted-foreground">
        ({related(item.categories)?.name ?? "Item"}, found in {related(item.buildings)?.name ?? "an unknown building"})
      </span>
    </p>
  );

  if (existing.data && isClaimStatus(existing.data.status)) {
    return (
      <>
        {summary}
        <p role="status">
          You already claimed this item on {formatToronto(existing.data.created_at)}. Status:{" "}
          <span className="font-medium">{claimStatusLabel(existing.data.status)}</span>
          {existing.data.status === "on_hold" && existing.data.hold_until
            ? `, until ${formatToronto(existing.data.hold_until)}`
            : null}
          .
        </p>
        <p>
          <Link href={routes.my} className={textLinkClass}>
            See my claims
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      {summary}
      <p>
        Photo ID shows who you are, not that the item is yours. To claim it,
        describe a detail that is not in the listing, and add proof if you have
        it.
      </p>
      <ClaimForm itemId={item.id} refCode={item.ref_code} holdDays={Number.isFinite(holdDays) ? holdDays : 7} />
      <p>
        <Link href={itemPath(item.ref_code)} className={textLinkClass}>
          Back to {item.ref_code}
        </Link>
      </p>
    </>
  );
}
