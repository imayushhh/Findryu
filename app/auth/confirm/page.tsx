import { Suspense } from "react";

import { completeSignIn } from "@/actions/auth";
import { PageShell } from "@/components/layout/page-shell";
import { routes, safeNextPath } from "@/lib/routes";
import { textLinkClass } from "@/lib/styles";

export const metadata = {
  title: "Finish sign-in",
};

export default function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    error?: string;
  }>;
}) {
  return (
    <PageShell title="Finish sign-in">
      <Suspense fallback={<p>Checking the sign-in link…</p>}>
        <ConfirmSignIn searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ConfirmSignIn({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const code = params.code ?? "";
  const tokenHash = params.token_hash ?? "";
  const linkFailed = Boolean(params.error) || (!code && !tokenHash);

  return (
    <>
      {linkFailed ? (
        <>
          <p>
            This sign-in link was already used or it has expired. Request a new
            email, then open that new link.
          </p>
          <p>
            <a href={routes.login} className={textLinkClass}>
              Back to sign in
            </a>
          </p>
        </>
      ) : (
        <>
          <p>
            Click continue to finish signing in. The link stays valid until you
            do.
          </p>
          <form action={completeSignIn}>
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={params.type ?? "email"} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="bg-primary text-primary-foreground mt-2 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Continue
            </button>
          </form>
        </>
      )}
    </>
  );
}
