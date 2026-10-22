import Link from "next/link";

import { signOut } from "@/actions/auth";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const navLinkClass =
  "rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function SignInLink({ locale }: { locale: Locale }) {
  return (
    <li>
      <Link
        href={routes.login}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
      >
        {t(locale, "signIn")}
      </Link>
    </li>
  );
}

export async function AuthNav({ locale }: { locale: Locale }) {
  const profile = await loadProfile();

  if (!profile) {
    return <SignInLink locale={locale} />;
  }

  const showStaff = profile.role === "staff" || profile.role === "admin";

  return (
    <>
      <li>
        <Link href={routes.search} className={navLinkClass}>
          {t(locale, "search")}
        </Link>
      </li>
      <li>
        <Link href={routes.report} className={navLinkClass}>
          {t(locale, "report")}
        </Link>
      </li>
      <li>
        <Link href={routes.my} className={navLinkClass}>
          {t(locale, "my")}
        </Link>
      </li>
      {showStaff ? (
        <li>
          <Link href={routes.staff} className={navLinkClass}>
            {t(locale, "staff")}
          </Link>
        </li>
      ) : null}
      {profile.role === "admin" ? (
        <li>
          <Link href={routes.admin} className={navLinkClass}>
            {t(locale, "admin")}
          </Link>
        </li>
      ) : null}
      <li className="max-w-full px-2 py-2 text-sm">
        <span className="sr-only">{t(locale, "signedInAs")}</span>
        <span className="block max-w-48 truncate">{profile.email}</span>
      </li>
      <li>
        <form action={signOut}>
          <button type="submit" className={navLinkClass}>
            {t(locale, "signOut")}
          </button>
        </form>
      </li>
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
