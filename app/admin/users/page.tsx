import { redirect } from "next/navigation";
import { Suspense } from "react";

import { UserRoleForm } from "@/components/admin/user-role-form";
import { PageShell } from "@/components/layout/page-shell";
import { type AppRole, getCurrentProfile } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "People and roles",
};

const listLimit = 50;

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <PageShell title="People and roles" wide>
      <Suspense fallback={<p>Loading people…</p>}>
        <UsersPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

async function UsersPanel({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.adminUsers)}`);
  }
  if (profile.role !== "admin") {
    redirect(`${routes.home}?notice=forbidden`);
  }

  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  let people = supabase
    .from("profiles")
    .select("id, email, full_name, role, location_id")
    .order("role", { ascending: false })
    .order("email")
    .limit(listLimit);
  if (query) {
    people = people.ilike("email", likePattern(query));
  }

  const [peopleResult, desksResult] = await Promise.all([
    people,
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
  ]);

  if (peopleResult.error || desksResult.error) {
    return <p>People could not be loaded. Refresh the page and try again.</p>;
  }

  const rows = peopleResult.data ?? [];
  const desks = desksResult.data ?? [];

  return (
    <>
      <p>
        To add someone, ask them to sign in to FindrYU once with their York
        email. They then appear here and you can make them staff or an admin.
        Staff work at one desk. Admins can do everything, at every desk.
      </p>
      <form action={routes.adminUsers} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
          Search by email
          <input
            name="q"
            type="search"
            defaultValue={query}
            className="border-input bg-background block h-11 w-full rounded-lg border px-3 text-base font-normal"
          />
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground min-h-11 rounded-lg px-4 text-sm font-medium"
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p>{query ? "No one with that email has signed in yet." : "No one has signed in yet."}</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((person) => (
            <li key={person.id} className="space-y-3 rounded-lg border border-border p-4">
              <p className="break-words">
                <span className="font-semibold">{person.email}</span>
                {person.full_name ? <span className="text-muted-foreground"> · {person.full_name}</span> : null}
              </p>
              <UserRoleForm
                userId={person.id}
                email={person.email}
                role={person.role as AppRole}
                locationId={person.location_id}
                desks={desks}
                isSelf={person.id === profile.id}
              />
            </li>
          ))}
        </ul>
      )}
      {rows.length === listLimit ? (
        <p className="text-sm text-muted-foreground">
          Showing the first {listLimit}. Search by email to find someone else.
        </p>
      ) : null}
    </>
  );
}
