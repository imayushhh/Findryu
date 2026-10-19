import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { deskPlace, related, specialHandlingNote } from "@/lib/items/text";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Report received",
};

export default function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  return (
    <PageShell title="Report received">
      <Suspense fallback={<p>Loading the reference number…</p>}>
        <SuccessPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function SuccessPanel({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.report)}`);
  }

  const params = await searchParams;
  const ref = params.ref ?? "";
  if (!/^FYU-\d{6}$/.test(ref)) {
    return <p>That report was not found.</p>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "ref_code, categories(name, special_handling), locations!items_intended_location_id_fkey(name, building, room, hours)",
    )
    .eq("ref_code", ref)
    .eq("reported_by", profile.id)
    .maybeSingle();

  const desk = related(data?.locations);
  const category = related(data?.categories);
  if (!data || !desk) {
    return <p>That report was not found.</p>;
  }

  const note = category ? specialHandlingNote(category.special_handling) : null;

  return (
    <>
      <p>
        Reference number{" "}
        <span className="font-semibold tracking-wide">{data.ref_code}</span>
      </p>
      <p>
        Drop it off at <span className="font-medium">{deskPlace(desk)}</span>.
      </p>
      {desk.hours ? <p>Hours: {desk.hours}</p> : null}
      {note ? <p className="font-medium">{note}</p> : null}
      <p>
        <Link
          href={routes.report}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 px-4")}
        >
          Report another item
        </Link>
      </p>
    </>
  );
}
