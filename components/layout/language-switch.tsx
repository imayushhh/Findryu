import { setLocale } from "@/actions/locale";
import type { Locale } from "@/lib/i18n";

const buttonClass =
  "min-h-11 min-w-11 rounded-md px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  return (
    <form action={setLocale} className="flex items-center gap-1" aria-label={locale === "fr" ? "Langue" : "Language"}>
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={locale === "en"}
        className={`${buttonClass} ${locale === "en" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="fr"
        aria-pressed={locale === "fr"}
        className={`${buttonClass} ${locale === "fr" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        FR
      </button>
    </form>
  );
}
