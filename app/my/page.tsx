import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requestAfterHoursPickup } from "@/actions/claim-review";
import { SubmitButton } from "@/components/items/submit-button";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { claimStatusExplanation, claimStatusLabel, isClaimStatus } from "@/lib/claims/text";
import { deskPlace, related } from "@/lib/items/text";
import { itemPath, lostReportEditPath, routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

export const metadata = {
  title: "My items",
};

const itemStatusLabels: Record<string, string> = {
  reported: "Waiting for you to drop it off",
  received: "At the desk",
  in_transit: "Moving between desks",
  collected: "Returned to its owner",
  contested: "Under review",
  archived: "Closed",
};

const lostNotices: Record<string, string> = {
  "lost-saved": "Your lost item is registered. We will email you if a matching item is handed in.",
  "lost-updated": "Your lost report is updated.",
  "lost-cancelled": "Your lost report is cancelled. You will not get more alerts for it.",
  "lost-failed": "That lost report could not be changed. Refresh the page and try again.",
};

export default function MyPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <PageShell title="My items" wide>
      <Suspense fallback={<p>Loading your items…</p>}>
        <MyPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function MyPanel({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.my)}`);
  }
  const { notice } = await searchParams;

  const supabase = await createClient();
  const [claims, reported, lost] = await Promise.all([
    supabase
      .from("claims")
      .select(
        "id, status, hold_until, rejection_reason, pickup_request, created_at, items(ref_code, description, status, current:locations!items_current_location_id_fkey(name, building, room, hours))",
      )
      .eq("claimant_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("items")
      .select(
        "id, ref_code, description, status, created_at, intended:locations!items_intended_location_id_fkey(name, building, room)",
      )
      .eq("reported_by", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lost_reports")
      .select(
        "id, description, status, lost_from, lost_to, created_at, categories(name), buildings(name), lost_report_alerts(id, items(ref_code, description, status))",
      )
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);
  const lostRows = lost.data ?? [];

  const claimRows = claims.data ?? [];
  const reportedRows = reported.data ?? [];

  return (
    <>
      {notice === "claimed" ? (
        <p role="status" className="rounded-lg border border-border bg-card p-4">
          Your claim was sent. Staff at the desk will review it.
        </p>
      ) : null}
      {notice && lostNotices[notice] ? (
        <p
          role={notice === "lost-failed" ? "alert" : "status"}
          className="rounded-lg border border-border bg-card p-4"
        >
          {lostNotices[notice]}
        </p>
      ) : null}
      {notice === "pickup" ? (
        <p role="status" className="rounded-lg border border-border bg-card p-4">
          After-hours pickup is requested. Bring photo ID to Security Services.
        </p>
      ) : null}
      {notice === "pickup-failed" ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-4">
          After-hours pickup could not be requested. Try again or contact the desk.
        </p>
      ) : null}

      <section aria-labelledby="my-claims" className="space-y-3">
        <h2 id="my-claims" className="text-xl font-semibold tracking-tight">
          My claims
        </h2>
        {claims.error ? <p>Your claims could not be loaded. Refresh the page.</p> : null}
        {!claims.error && claimRows.length === 0 ? (
          <p>
            You have not claimed anything.{" "}
            <Link href={routes.search} className="font-medium text-primary underline underline-offset-4">
              Search for a lost item
            </Link>
            .
          </p>
        ) : null}
        <ul className="grid gap-3">
          {claimRows.map((claim) => {
            const item = related(claim.items);
            const desk = related(item?.current ?? null);
            const status = isClaimStatus(claim.status) ? claim.status : null;
            return (
              <li key={claim.id} className="space-y-1 rounded-lg border border-border p-4">
                <p className="font-semibold">
                  {item ? (
                    <Link href={itemPath(item.ref_code)} className={textLinkClass}>
                      {item.ref_code}
                    </Link>
                  ) : (
                    "Item"
                  )}
                </p>
                {item ? <p className="break-words">{item.description}</p> : null}
                {status ? (
                  <>
                    <p>
                      Status: <span className="font-medium">{claimStatusLabel(status)}</span>
                      {status === "on_hold" && claim.hold_until
                        ? `, until ${formatToronto(claim.hold_until)}`
                        : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{claimStatusExplanation(status)}</p>
                  </>
                ) : null}
                {status === "rejected" && claim.rejection_reason ? (
                  <p className="text-sm">Reason: {claim.rejection_reason}</p>
                ) : null}
                {status === "approved" && desk ? (
                  <p className="text-sm">
                    Pick up at {deskPlace(desk)}.{desk.hours ? ` Hours: ${desk.hours}` : null}
                  </p>
                ) : null}
                {status === "approved" && claim.pickup_request === "desk" ? (
                  <form action={requestAfterHoursPickup}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <SubmitButton pendingLabel="Requesting…">Pick up after hours at Security Services</SubmitButton>
                  </form>
                ) : null}
                {status === "approved" && claim.pickup_request === "security_services" ? (
                  <p className="text-sm">
                    You asked for after-hours pickup. Security Services will hold the item once staff move it
                    there.
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">Sent {formatToronto(claim.created_at)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="my-lost" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-lost" className="text-xl font-semibold tracking-tight">
            Lost items I registered
          </h2>
          <Link href={routes.lostReportNew} className={textLinkClass}>
            Register a lost item
          </Link>
        </div>
        {lost.error ? <p>Your lost reports could not be loaded. Refresh the page.</p> : null}
        {!lost.error && lostRows.length === 0 ? (
          <p>You have not registered a lost item. Register one to get an email if it is handed in.</p>
        ) : null}
        <ul className="grid gap-3">
          {lostRows.map((report) => {
            const matches = (report.lost_report_alerts ?? [])
              .map((alert) => related(alert.items))
              .filter(
                (item): item is NonNullable<typeof item> =>
                  item !== null && (item.status === "received" || item.status === "in_transit"),
              );
            return (
              <li key={report.id} className="space-y-1 rounded-lg border border-border p-4">
                <p className="break-words font-semibold">{report.description}</p>
                <p className="text-sm text-muted-foreground">
                  {[related(report.categories)?.name, related(report.buildings)?.name, `${report.lost_from} to ${report.lost_to}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p>
                  Status:{" "}
                  <span className="font-medium">
                    {report.status === "active" ? "Watching for matches" : report.status === "cancelled" ? "Cancelled" : "Matched"}
                  </span>
                </p>
                {matches.length > 0 ? (
                  <div>
                    <p className="font-medium">Possible matches:</p>
                    <ul>
                      {matches.map((item) => (
                        <li key={item.ref_code}>
                          <Link href={itemPath(item.ref_code)} className={textLinkClass}>
                            {item.ref_code}: {item.description}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {report.status === "active" ? (
                  <p>
                    <Link href={lostReportEditPath(report.id)} className={textLinkClass}>
                      Edit or cancel<span className="sr-only"> this lost report</span>
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="my-reports" className="space-y-3">
        <h2 id="my-reports" className="text-xl font-semibold tracking-tight">
          Items I reported
        </h2>
        {reported.error ? <p>Your reports could not be loaded. Refresh the page.</p> : null}
        {!reported.error && reportedRows.length === 0 ? <p>You have not reported a found item.</p> : null}
        <ul className="grid gap-3">
          {reportedRows.map((item) => {
            const desk = related(item.intended);
            return (
              <li key={item.id} className="space-y-1 rounded-lg border border-border p-4">
                <p className="font-semibold">{item.ref_code}</p>
                <p className="break-words">{item.description}</p>
                <p>
                  Status: <span className="font-medium">{itemStatusLabels[item.status] ?? item.status}</span>
                </p>
                {item.status === "reported" && desk ? (
                  <p className="text-sm">Drop it off at {deskPlace(desk)}.</p>
                ) : null}
                <p className="text-sm text-muted-foreground">Reported {formatToronto(item.created_at)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
