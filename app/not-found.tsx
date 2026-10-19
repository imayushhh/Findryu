import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";

export const metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <PageShell title="Not found">
      <p>
        This page or item could not be found. The link may be wrong, or the
        item may already be back with its owner.
      </p>
      <p>
        <Link href={routes.search} className={textLinkClass}>
          Search for a lost item
        </Link>
      </p>
    </PageShell>
  );
}
