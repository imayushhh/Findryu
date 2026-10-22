import { getLocale, t } from "@/lib/i18n";

export async function SiteFooter() {
  const locale = await getLocale();
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-foreground">
        <p className="font-medium">FindrYU</p>
        <p>{t(locale, "footer")}</p>
      </div>
    </footer>
  );
}
