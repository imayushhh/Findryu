import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ClaimQueues } from "@/components/claims/claim-queues";
import { PastHoldingPeriod } from "@/components/items/past-holding";
import { SpecialBanner } from "@/components/items/special-banner";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { related } from "@/lib/items/text";
import { routes, staffItemPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Staff",
};

export default function StaffPage() {
  return (
    <PageShell title="Staff desk" wide>
      <Suspense fallback={<p>Loading the desk…</p>}>
        <StaffDesk />
      </Suspense>
    </PageShell>
  );
}

async function StaffDesk() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.staff)}`);
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }

  const supabase = await createClient();
  let awaiting = supabase
    .from("items")
    .select(
      "id, ref_code, description, found_at, categories(name, special_handling), buildings(name), intended:locations!items_intended_location_id_fkey(name)",
    )
    .eq("status", "reported")
    .order("created_at", { ascending: true });

  if (profile.role === "staff") {
    if (!profile.locationId) {
      return <p>An admin must assign this account to a desk before items can be received.</p>;
    }
    awaiting = awaiting.eq("intended_location_id", profile.locationId);
  }

  let special = supabase
    .from("items")
    .select(
      "id, ref_code, description, categories!inner(special_handling), current:locations!items_current_location_id_fkey(name, kind)",
    )
    .in("status", ["received", "in_transit"])
    .in("categories.special_handling", ["yu_card", "passport"]);

  if (profile.role === "staff" && profile.locationId) {
    special = special.eq("current_location_id", profile.locationId);
  }

  const [waiting, alerts, desk] = await Promise.all([
    awaiting,
    special,
    profile.locationId
      ? supabase.from("locations").select("name").eq("id", profile.locationId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const waitingRows = waiting.data ?? [];
  const alertRows = (alerts.data ?? []).filter((item) => {
    const category = related(item.categories);
    const location = related(item.current);
    if (!category || !location) {
      return false;
    }
    if (category.special_handling === "yu_card") {
      return location.kind !== "yu_card_office";
    }
    return location.kind !== "security";
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {profile.role === "admin"
            ? "All desks. You can receive any reported item."
            : `Desk: ${desk.data?.name ?? "your assigned desk"}.`}
        </p>
        <Link
          href={routes.staffIntake}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Log a walk-in
        </Link>
      </div>

      <ClaimQueues />

      <section aria-labelledby="awaiting-receipt" className="space-y-3">
        <h2 id="awaiting-receipt" className="text-xl font-semibold tracking-tight">
          Awaiting receipt
        </h2>
        {waiting.error ? <p>The waiting list could not be loaded.</p> : null}
        {!waiting.error && waitingRows.length === 0 ? (
          <p>No items are waiting at this desk.</p>
        ) : null}
        <ul className="grid gap-3">
          {waitingRows.map((item) => {
            const category = related(item.categories);
            const building = related(item.buildings);
            const intended = related(item.intended);
            return (
              <li key={item.id} className="rounded-lg border border-border p-4">
                <SpecialBanner handling={category?.special_handling ?? "none"} />
                <p className="font-semibold">{item.ref_code}</p>
                <p>{item.description}</p>
                <p className="text-sm text-muted-foreground">
                  {[category?.name, building?.name, formatToronto(item.found_at), intended?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2">
                  <Link
                    href={staffItemPath(item.id)}
                    className={textLinkClass}
                  >
                    Receive this item
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="special-items" className="space-y-3">
        <h2 id="special-items" className="text-xl font-semibold tracking-tight">
          Special handling
        </h2>
        {alerts.error ? <p>Special items could not be loaded.</p> : null}
        {alertRows.length === 0 && !alerts.error ? (
          <p>No YU-cards or passports are waiting to be transferred.</p>
        ) : null}
        <ul className="grid gap-3">
          {alertRows.map((item) => {
            const category = related(item.categories);
            const location = related(item.current);
            return (
              <li key={item.id} className="rounded-lg border border-border p-4">
                <SpecialBanner handling={category?.special_handling ?? "none"} />
                <p className="mt-2 font-semibold">{item.ref_code}</p>
                <p>{item.description}</p>
                {location ? <p className="text-sm text-muted-foreground">Currently at {location.name}</p> : null}
                <p className="mt-2">
                  <Link
                    href={staffItemPath(item.id)}
                    className={textLinkClass}
                  >
                    Open item
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <PastHoldingPeriod locationId={profile.role === "admin" ? null : profile.locationId} />
    </>
  );
}
