import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <PageShell title="Admin">
      <p>
        Give people the staff or admin role and assign staff to their desk.
        Desks, buildings, categories, settings, and the audit log are added in
        a later step.
      </p>
      <p>
        <Link href={routes.adminUsers} className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}>
          Manage people and roles
        </Link>
      </p>
    </PageShell>
  );
}
