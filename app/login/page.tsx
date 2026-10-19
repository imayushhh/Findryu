import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { PageShell } from "@/components/layout/page-shell";
import { getCurrentProfile } from "@/lib/auth";
import { isStaffOrAdminPath, safeNextPath } from "@/lib/routes";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <PageShell title="Sign in">
      <Suspense fallback={<p>Loading sign-in…</p>}>
        <LoginPanel searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function LoginPanel({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(next);
  }

  const blockedPath =
    params.next && isStaffOrAdminPath(safeNextPath(params.next))
      ? safeNextPath(params.next)
      : null;
  const initialError =
      params.error === "link"
      ? "That sign-in link was already opened, so it cannot be used again. Request a new email and open the new link."
      : undefined;

  return (
    <>
      {blockedPath ? (
        <p>
          You need to sign in before opening{" "}
          <span className="font-medium">{blockedPath}</span>.
        </p>
      ) : null}
      <p>
        Use your York email, ending in @yorku.ca or @my.yorku.ca. FindrYU will
        email you a sign-in link.
      </p>
      <LoginForm next={next} initialError={initialError} />
    </>
  );
}
