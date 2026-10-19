import Link from "next/link";
import { Suspense } from "react";

import { saveSettings } from "@/actions/catalog";
import { AdminForm, PrivacyCleanupButton } from "@/components/admin/admin-forms";
import { TextField } from "@/components/admin/fields";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdminPage } from "@/lib/admin";
import { routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings and privacy",
};

export default function AdminSettingsPage() {
  return (
    <PageShell title="Settings and privacy">
      <Suspense fallback={<p>Loading settings…</p>}>
        <SettingsPanel />
      </Suspense>
    </PageShell>
  );
}

async function SettingsPanel() {
  await requireAdminPage(routes.adminSettings);
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) {
    return <p>Settings could not be loaded. Refresh the page.</p>;
  }
  const value = (key: string, fallback: string) => data?.find((row) => row.key === key)?.value ?? fallback;

  return (
    <>
      <AdminForm action={saveSettings} submitLabel="Save settings">
        <TextField
          id="holding_period_days"
          name="holding_period_days"
          label="Holding period (days)"
          type="number"
          defaultValue={value("holding_period_days", "30")}
          hint="Received items older than this appear under Past holding period on the staff desk."
        />
        <TextField
          id="no_proof_hold_days"
          name="no_proof_hold_days"
          label="No-proof hold (days)"
          type="number"
          defaultValue={value("no_proof_hold_days", "7")}
          hint="Claims without proof wait this long before staff can approve them. Set 0 for a demo to allow approval right away."
        />
        <TextField
          id="contact_retention_days"
          name="contact_retention_days"
          label="Keep claim contact details for (days)"
          type="number"
          defaultValue={value("contact_retention_days", "180")}
          hint="The privacy cleanup removes phone numbers and addresses from claims collected longer ago than this."
        />
      </AdminForm>

      <section aria-labelledby="privacy-cleanup" className="space-y-3">
        <h2 id="privacy-cleanup" className="text-xl font-semibold tracking-tight">
          Privacy cleanup
        </h2>
        <p>
          Removes the phone number and home address from every claim whose item was collected more than{" "}
          {value("contact_retention_days", "180")} days ago. Each run is written to the{" "}
          <Link href={routes.adminAudit} className={textLinkClass}>
            audit log
          </Link>
          .
        </p>
        <PrivacyCleanupButton />
      </section>
    </>
  );
}
