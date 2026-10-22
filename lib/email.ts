import { headers } from "next/headers";

import { deskPlace } from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const defaultSender = "FindrYU <onboarding@resend.dev>";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function siteOrigin() {
  const list = await headers();
  const origin = list.get("origin");
  if (origin) {
    return origin;
  }
  const host = list.get("x-forwarded-host") ?? list.get("host");
  return host ? `${list.get("x-forwarded-proto") ?? "https"}://${host}` : "";
}

/** Sends through Resend. Returns false, without throwing, when it is not configured or refused. */
export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`Email not sent (RESEND_API_KEY is not set): ${subject}`);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || defaultSender, to: [to], subject, html }),
    });
    if (!response.ok) {
      console.error(`Resend refused "${subject}" (${response.status}): ${(await response.text()).slice(0, 200)}`);
      return false;
    }
    console.info(`Email sent: ${subject}`);
    return true;
  } catch (caught) {
    console.error(`Email "${subject}" failed:`, caught instanceof Error ? caught.message : caught);
    return false;
  }
}

async function myItemsLink() {
  return `<p>Follow it on <a href="${escapeHtml(`${await siteOrigin()}${routes.my}`)}">My items</a>.</p>`;
}

type Desk = { name: string; building: string | null; room: string | null; hours: string | null };

function deskLines(desk: Desk | null) {
  if (!desk) return "";
  return `<p>Desk: ${escapeHtml(deskPlace(desk))}${desk.hours ? `<br>Hours: ${escapeHtml(desk.hours)}` : ""}</p>`;
}

/** To the finder, right after they report a found item. */
export async function emailFoundReportSubmitted(to: string, refCode: string, locationId: string) {
  const supabase = await createClient();
  const { data: desk } = await supabase
    .from("locations")
    .select("name, building, room, hours")
    .eq("id", locationId)
    .maybeSingle();
  await sendEmail(
    to,
    `We got your report: ${refCode}`,
    `<p>Thank you for reporting a found item on FindrYU.</p>
<p>Reference number: <strong>${escapeHtml(refCode)}</strong></p>
<p>Please drop the item off at the desk you chose and give staff this reference number.</p>
${deskLines(desk)}
${await myItemsLink()}`,
  );
}

/** To the finder, when staff receive the item they reported. Walk-ins have no finder account. */
export async function emailFinderItemReceived(itemId: string) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select(
      "ref_code, reported_by, finder:profiles!items_reported_by_fkey(email), current:locations!items_current_location_id_fkey(name, building, room, hours)",
    )
    .eq("id", itemId)
    .maybeSingle();
  const finder = Array.isArray(item?.finder) ? item.finder[0] : item?.finder;
  const desk = Array.isArray(item?.current) ? item.current[0] : item?.current;
  if (!item || !finder?.email) {
    return;
  }
  await sendEmail(
    finder.email,
    `Your found item was received: ${item.ref_code}`,
    `<p>The item you reported, <strong>${escapeHtml(item.ref_code)}</strong>, was received at the desk. Thank you for handing it in.</p>
${deskLines(desk ?? null)}
<p>It is now listed in search so the owner can claim it.</p>
${await myItemsLink()}`,
  );
}

/** To the owner, right after they register a lost item. */
export async function emailLostReportSaved(to: string, description: string) {
  await sendEmail(
    to,
    "Your lost item is registered",
    `<p>We are watching for this item on FindrYU:</p>
<p><strong>${escapeHtml(description)}</strong></p>
<p>We will email you if a matching item is handed in at a Keele desk.</p>
${await myItemsLink()}`,
  );
}
