import { escapeHtml, sendEmail, siteOrigin } from "@/lib/email";
import { itemPath, routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Records and emails each new match between a just-received item and active lost reports.
 * Runs as the signed-in staff member. Failures are logged and never block the receive.
 */
export async function alertLostReportOwners(itemId: string) {
  try {
    const supabase = await createClient();
    const { data: matches, error } = await supabase.rpc("matching_lost_reports", { item_id: itemId });
    if (error || !matches || matches.length === 0) {
      if (error) console.error("matching_lost_reports failed:", error.message);
      return;
    }

    const { data: created } = await supabase
      .from("lost_report_alerts")
      .upsert(
        matches.map((report: { id: string }) => ({ lost_report_id: report.id, item_id: itemId })),
        { onConflict: "lost_report_id,item_id", ignoreDuplicates: true },
      )
      .select("id, lost_report_id");
    if (!created || created.length === 0) {
      return;
    }

    const ownerIds = [...new Set(matches.map((report: { owner_id: string }) => report.owner_id))];
    const [{ data: owners }, { data: item }] = await Promise.all([
      supabase.from("profiles").select("id, email").in("id", ownerIds),
      supabase.from("items").select("ref_code, description").eq("id", itemId).maybeSingle(),
    ]);
    if (!item) {
      return;
    }

    const origin = await siteOrigin();
    const link = `${origin}${itemPath(item.ref_code)}`;
    for (const alert of created) {
      const report = matches.find((match: { id: string }) => match.id === alert.lost_report_id);
      const email = owners?.find((owner) => owner.id === report?.owner_id)?.email;
      if (!report || !email) continue;

      const sent = await sendEmail(
        email,
        `A possible match for your lost item: ${item.ref_code}`,
        `<p>An item that matches your lost report was just handed in at a FindrYU desk.</p>
<p><strong>${escapeHtml(item.ref_code)}</strong>: ${escapeHtml(item.description)}</p>
<p><a href="${escapeHtml(link)}">View the item and claim it</a>. Bring photo ID when you pick it up.</p>
<p>You can edit or cancel your lost report on <a href="${escapeHtml(`${origin}${routes.my}`)}">My items</a>.</p>`,
      );
      if (sent) {
        await supabase.from("lost_report_alerts").update({ emailed_at: new Date().toISOString() }).eq("id", alert.id);
      }
    }
  } catch (caught) {
    console.error("Lost report alerts failed:", caught instanceof Error ? caught.message : caught);
  }
}
