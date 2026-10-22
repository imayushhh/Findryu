import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
      <Suspense fallback={null}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={null}>
        <HowItWorks />
      </Suspense>
    </div>
  );
}

async function HomeHero() {
  const locale = await getLocale();
  return (
    <section className="max-w-2xl">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">{t(locale, "eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{t(locale, "heroTitle")}</h1>
      <p className="mt-4 text-base leading-7">{t(locale, "heroBody")}</p>
      <div className="mt-6 flex min-h-11 flex-wrap gap-3">
        <Suspense fallback={null}>
          <HeroActions locale={locale} />
        </Suspense>
      </div>
    </section>
  );
}

async function HowItWorks() {
  const locale = await getLocale();
  const steps = [
    { title: t(locale, "step1Title"), body: t(locale, "step1Body") },
    { title: t(locale, "step2Title"), body: t(locale, "step2Body") },
    { title: t(locale, "step3Title"), body: t(locale, "step3Body") },
  ];
  return (
    <section className="mt-10" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-xl font-semibold tracking-tight">
        {t(locale, "how")}
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-primary">
              {t(locale, "step")} {index + 1}
            </p>
            <h3 className="mt-1 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function HeroActions({ locale }: { locale: Locale }) {
  const profile = await loadProfile();

  if (!profile) {
    return (
      <Link href={routes.login} className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
        {t(locale, "signIn")}
      </Link>
    );
  }

  return (
    <>
      <Link href={routes.search} className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
        {t(locale, "searchLost")}
      </Link>
      <Link
        href={routes.report}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 px-4")}
      >
        {t(locale, "reportFound")}
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
      {t(await getLocale(), "forbidden")}
    </p>
  );
}
