import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SpecialBanner } from "@/components/items/special-banner";
import {
  ArriveForm,
  HiddenDetailForm,
  ReceiveForm,
  TransferForm,
} from "@/components/items/staff-item-forms";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import {
  deskPlace,
  related,
  specialHandlingNote,
  transferReasonLabel,
  type TransferReason,
} from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";

const notices: Record<string, string> = {
  received: "The item is received and the hidden detail is saved.",
  secret: "The hidden detail is updated.",
  transferred: "The transfer is recorded. The current desk is updated.",
  arrived: "The item is marked arrived.",
  unchanged: "That item could not be updated.",
};

export const metadata = {
  title: "Staff item",
};

export default function StaffItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  return (
    <Suspense fallback={<PageShell title="Item"><p>Loading the item…</p></PageShell>}>
      <StaffItem params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffItem({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.staff)}`);
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const noticeKey = (await searchParams).notice;
  const notice = noticeKey ? notices[noticeKey] : undefined;
  const supabase = await createClient();
  const [{ data: item }, { data: secret }, { data: transfers }, { data: locations }] =
    await Promise.all([
      supabase
        .from("items")
        .select(
          "id, ref_code, description, found_at, status, current_location_id, intended_location_id, categories(name, special_handling), buildings(name), intended:locations!items_intended_location_id_fkey(id, name, building, room, hours, kind), current:locations!items_current_location_id_fkey(id, name, building, room, hours, kind), item_photos(storage_path)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("item_secrets").select("hidden_detail").eq("item_id", id).maybeSingle(),
      supabase
        .from("item_transfers")
        .select(
          "id, reason, sent_at, received_at, from:locations!item_transfers_from_location_id_fkey(name), to:locations!item_transfers_to_location_id_fkey(name)",
        )
        .eq("item_id", id)
        .order("sent_at", { ascending: false }),
      supabase.from("locations").select("id, name, kind").eq("active", true).order("name"),
    ]);

  if (!item) {
    notFound();
  }

  const category = related(item.categories);
  const building = related(item.buildings);
  const intended = related(item.intended);
  const current = related(item.current);
  const handling = category?.special_handling ?? "none";
  const atThisDesk =
    profile.role === "admin" ||
    profile.locationId === item.current_location_id ||
    (item.status === "reported" && profile.locationId === item.intended_location_id);
  const photos = await signedPhotoUrls(item.item_photos ?? []);
  const destination =
    handling === "yu_card"
      ? locations?.find((location) => location.kind === "yu_card_office")
      : handling === "passport"
        ? locations?.find((location) => location.kind === "security")
        : undefined;
  const reason: TransferReason =
    handling === "yu_card" ? "yu_card_office" : handling === "passport" ? "security_services" : "routine";
  const transferChoices = (locations ?? []).filter(
    (location) => location.id !== item.current_location_id,
  );

  return (
    <PageShell title={item.ref_code}>
      {notice ? <p role="status">{notice}</p> : null}
      <SpecialBanner handling={handling} />
      {specialHandlingNote(handling) ? <p>{specialHandlingNote(handling)}</p> : null}
      <p>{item.description}</p>
      <p>
        {[category?.name, building?.name, formatToronto(item.found_at)].filter(Boolean).join(" · ")}
      </p>
      <p>Status: {item.status.replaceAll("_", " ")}</p>
      {intended ? <p>Chosen drop-off: {deskPlace(intended)}</p> : null}
      {current ? <p>Current desk: {deskPlace(current)}</p> : null}
      {intended?.hours && item.status === "reported" ? <p>Hours: {intended.hours}</p> : null}
      {photos.length > 0 ? (
        <ul className="grid gap-3">
          {photos.map((photo) => (
            <li key={photo.path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={item.description}
                className="max-h-80 w-full rounded-lg border border-border object-contain"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {item.status === "reported" && atThisDesk ? (
        <section aria-labelledby="receive-item" className="space-y-3">
          <h2 id="receive-item" className="text-xl font-semibold">
            Receive
          </h2>
          <ReceiveForm itemId={item.id} />
        </section>
      ) : null}
      {item.status === "reported" && !atThisDesk ? (
        <p>Only staff at the chosen desk can receive this item.</p>
      ) : null}

      {item.status !== "reported" && secret?.hidden_detail && atThisDesk ? (
        <section aria-labelledby="hidden-detail" className="space-y-3">
          <h2 id="hidden-detail" className="text-xl font-semibold">
            Hidden detail
          </h2>
          <HiddenDetailForm itemId={item.id} currentDetail={secret.hidden_detail} />
        </section>
      ) : null}

      {(item.status === "received" || item.status === "in_transit") && atThisDesk ? (
        <section aria-labelledby="transfer-item" className="space-y-3">
          <h2 id="transfer-item" className="text-xl font-semibold">
            Transfer
          </h2>
          {item.status === "in_transit" ? <ArriveForm itemId={item.id} /> : null}
          <TransferForm
            itemId={item.id}
            locations={transferChoices}
            defaultLocationId={
              destination && destination.id !== item.current_location_id ? destination.id : undefined
            }
            defaultReason={reason}
          />
        </section>
      ) : null}

      {(transfers ?? []).length > 0 ? (
        <section aria-labelledby="transfer-history" className="space-y-2">
          <h2 id="transfer-history" className="text-xl font-semibold">
            Transfers
          </h2>
          <ul className="space-y-2">
            {(transfers ?? []).map((transfer) => {
              const from = related(transfer.from);
              const to = related(transfer.to);
              return (
                <li key={transfer.id}>
                  {from?.name ?? "Desk"} to {to?.name ?? "desk"}, {transferReasonLabel(transfer.reason)},{" "}
                  {formatToronto(transfer.sent_at)}
                  {transfer.received_at ? `, arrived ${formatToronto(transfer.received_at)}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p>
        <Link href={routes.staff} className={textLinkClass}>
          Back to the desk
        </Link>
      </p>
    </PageShell>
  );
}

async function signedPhotoUrls(photos: { storage_path: string }[]) {
  const supabase = await createClient();
  const signed = await Promise.all(
    photos.map(async (photo) => {
      const { data } = await supabase.storage.from("item-photos").createSignedUrl(photo.storage_path, 120);
      return data?.signedUrl ? { path: photo.storage_path, url: data.signedUrl } : null;
    }),
  );
  return signed.filter((photo) => photo !== null);
}
