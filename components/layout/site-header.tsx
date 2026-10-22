import Link from "next/link";
import { Suspense } from "react";

import { AuthNav } from "@/components/layout/auth-nav";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { getLocale, t } from "@/lib/i18n";
import { SetLang } from "@/components/layout/set-lang";
import { routes } from "@/lib/routes";

const navLinkClass =
  "rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export async function SiteHeader() {
  const locale = await getLocale();
  return (
    <header className="border-b border-border bg-background">
      <SetLang locale={locale} />
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-foreground"
      >
        {t(locale, "skip")}
      </a>
      <div className="h-1 bg-primary" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href={routes.home}
          className="rounded-md text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Findr<span className="text-primary">YU</span>
        </Link>
        <nav aria-label={t(locale, "navLabel")}>
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={routes.home} className={navLinkClass}>
                {t(locale, "home")}
              </Link>
            </li>
            <Suspense fallback={<li aria-hidden="true" className="h-11 w-24" />}>
              <AuthNav locale={locale} />
            </Suspense>
            <li>
              <LanguageSwitch locale={locale} />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
