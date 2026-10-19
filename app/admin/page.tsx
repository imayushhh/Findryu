import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { routes } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";

export const metadata = {
  title: "Admin",
};

const sections: { href: string; title: string; text: string }[] = [
  { href: routes.adminUsers, title: "People and roles", text: "Make people staff or admins and assign each staff member a desk." },
  { href: routes.adminLocations, title: "Desks", text: "Add drop-off points, change hours, or turn a desk off." },
  { href: routes.adminBuildings, title: "Buildings", text: "The buildings people choose when they report or search." },
  { href: routes.adminCategories, title: "Categories", text: "Item categories and which ones need YU-card or passport handling." },
  { href: routes.adminSettings, title: "Settings and privacy", text: "Holding period, no-proof hold, contact retention, and the privacy cleanup." },
  { href: routes.adminArchived, title: "Archived items", text: "Restore an item that was donated or disposed by mistake." },
  { href: routes.adminAudit, title: "Audit log", text: "Every status change on items and claims, with who made it." },
];

export default function AdminPage() {
  return (
    <PageShell title="Admin" wide>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href} className="rounded-lg border border-border p-4">
            <Link href={section.href} className={`${textLinkClass} text-lg`}>
              {section.title}
            </Link>
            <p className="text-sm text-muted-foreground">{section.text}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
