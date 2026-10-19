import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Report a found item",
    body: "Describe what you found, add a photo, and choose the Keele desk where you will drop it off.",
  },
  {
    title: "Search where you lost it",
    body: "Start with the building, then look through items already received at a drop-off point.",
  },
  {
    title: "Claim it with a hidden detail",
    body: "Photo ID shows who you are. A detail that is never listed publicly shows the item is yours.",
  },
];

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <Suspense fallback={null}>
        <AccessNotice searchParams={searchParams} />
      </Suspense>
      <section className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          York University · Keele campus
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          Find what was lost. Return what was found.
        </h1>
        <p className="mt-4 text-base leading-7">
          FindrYU is the lost-and-found for students, faculty, and staff at
          York&apos;s Keele campus. Finders hand items to a desk. Owners search,
          claim, and pick up with photo ID.
        </p>
        <div className="mt-6 flex min-h-11 flex-wrap gap-3">
          <Suspense fallback={null}>
            <HeroActions />
          </Suspense>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-sm font-medium text-primary">
                Step {index + 1}
              </p>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

async function HeroActions() {
  const profile = await loadProfile();

  if (!profile) {
    return (
      <Link href={routes.login} className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
        Sign in
      </Link>
    );
  }

  return (
    <>
      <Link href={routes.search} className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
        Search for a lost item
      </Link>
      <Link
        href={routes.report}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 px-4")}
      >
        Report a found item
      </Link>
    </>
  );
}

async function loadProfile() {
  try {
    return await getCurrentProfile();
  } catch {
    return null;
  }
}

async function AccessNotice({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  if (notice !== "forbidden") {
    return null;
  }

  return (
    <p role="alert" className="mb-6 max-w-2xl rounded-lg border border-border bg-card p-4">
      That page is only available for your assigned role.
    </p>
  );
}
