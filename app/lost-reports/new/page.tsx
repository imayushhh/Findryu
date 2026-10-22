import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { LostReportForm } from "@/components/lost-reports/lost-report-form";
import { getCurrentProfile } from "@/lib/auth";
import { loadLostReportChoices } from "@/lib/lost-reports";
import { routes } from "@/lib/routes";
import { torontoToday } from "@/lib/time";

export const metadata = {
  title: "Register a lost item",
};

export default function NewLostReportPage() {
  return (
    <PageShell title="Register a lost item">
      <Suspense fallback={<p>Loading the form…</p>}>
        <NewLostReport />
      </Suspense>
    </PageShell>
  );
}

async function NewLostReport() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.lostReportNew)}`);
  }
  const choices = await loadLostReportChoices();
  if (!choices) {
    return <p>The form could not be loaded. Refresh the page and try again.</p>;
  }

  return (
    <>
      <p>
        Tell us what you lost and when. If a matching item is handed in at a Keele desk, we email {profile.email}{" "}
        and show the match on My items. Your report is private.
      </p>
      <LostReportForm categories={choices.categories} buildings={choices.buildings} today={torontoToday()} />
    </>
  );
}
