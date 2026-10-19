import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { deskPlace, related } from "@/lib/items/text";
import { signedItemPhotoUrls } from "@/lib/items/photos";
import { itemClaimPath, routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import { formatToronto } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Found item",
};

export default function ItemPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense fallback={<PageShell title="Found item"><p>Loading the item…</p></PageShell>}>
      <ItemDetail params={params} />
    </Suspense>
  );
}

async function ItemDetail({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(`/items/${ref}`)}`);
  }
  if (!/^FYU-\d{6}$/.test(ref)) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "ref_code, description, found_at, status, categories(name), buildings(name), current:locations!items_current_location_id_fkey(name, building, room, hours), item_photos(storage_path)",
    )
    .eq("ref_code", ref)
    .maybeSingle();

  if (!data || (data.status !== "received" && data.status !== "in_transit")) {
    notFound();
  }

  const category = related(data.categories);
  const building = related(data.buildings);
  const desk = related(data.current);
  const urls = await signedItemPhotoUrls((data.item_photos ?? []).map((photo) => photo.storage_path));

  return (
    <PageShell title={data.ref_code}>
      <p>{data.description}</p>
      <p>
        {[category?.name, building?.name, formatToronto(data.found_at)].filter(Boolean).join(" · ")}
      </p>
      {desk ? (
        <>
          <p>Current drop-off: {deskPlace(desk)}</p>
          {desk.hours ? <p>Hours: {desk.hours}</p> : null}
        </>
      ) : (
        <p>The current desk has not been recorded yet.</p>
      )}
      {data.status === "in_transit" ? <p>This item is being moved between desks.</p> : null}
      <ul className="grid gap-3">
        {(data.item_photos ?? []).map((photo) => {
          const url = urls.get(photo.storage_path);
          if (!url) {
            return null;
          }
          return (
            <li key={photo.storage_path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={data.description}
                className="max-h-80 w-full rounded-lg border border-border object-contain"
              />
            </li>
          );
        })}
      </ul>
      <p>
        <Link
          href={itemClaimPath(data.ref_code)}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Claim this item
        </Link>
      </p>
      <p>
        <Link href={routes.search} className={textLinkClass}>
          Back to search
        </Link>
      </p>
    </PageShell>
  );
}
