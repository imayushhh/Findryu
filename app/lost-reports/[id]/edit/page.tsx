import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { cancelLostReport } from "@/actions/lost-reports";
import { SubmitButton } from "@/components/items/submit-button";
import { PageShell } from "@/components/layout/page-shell";
import { LostReportForm } from "@/components/lost-reports/lost-report-form";
import { getCurrentProfile } from "@/lib/auth";
import { loadLostReportChoices } from "@/lib/lost-reports";
import { lostReportEditPath, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { torontoToday } from "@/lib/time";

export const metadata = {
  title: "Edit lost item",
};

export default function EditLostReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell title="Edit lost item">
      <Suspense fallback={<p>Loading your report…</p>}>
        <EditLostReport params={params} />
      </Suspense>
    </PageShell>
  );
}

async function EditLostReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(lostReportEditPath(id))}`);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: report }, choices] = await Promise.all([
    supabase
      .from("lost_reports")
      .select("id, category_id, description, building_id, lost_from, lost_to, photo_path, status")
      .eq("id", id)
      .eq("owner_id", profile.id)
      .maybeSingle(),
    loadLostReportChoices(),
  ]);
  if (!report) {
    notFound();
  }
  if (!choices) {
    return <p>The form could not be loaded. Refresh the page and try again.</p>;
  }
  if (report.status !== "active") {
    return <p>This lost report is {report.status === "cancelled" ? "cancelled" : "closed"} and can no longer be edited.</p>;
  }

  return (
    <>
      <LostReportForm
        categories={choices.categories}
        buildings={choices.buildings}
        today={torontoToday()}
        report={{
          id: report.id,
          categoryId: report.category_id,
          description: report.description,
          buildingId: report.building_id,
          lostFrom: report.lost_from,
          lostTo: report.lost_to,
          hasPhoto: Boolean(report.photo_path),
        }}
      />
      <section aria-labelledby="cancel-report" className="space-y-3 border-t border-border pt-6">
        <h2 id="cancel-report" className="text-xl font-semibold tracking-tight">
          Cancel this report
        </h2>
        <p>If you found it, or no longer want alerts, cancel the report. Its photo is deleted.</p>
        <form action={cancelLostReport}>
          <input type="hidden" name="id" value={report.id} />
          <SubmitButton pendingLabel="Cancelling…">Cancel lost report</SubmitButton>
        </form>
      </section>
    </>
  );
}
