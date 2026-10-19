import { NextResponse } from "next/server";

import { routes, safeNextPath } from "@/lib/routes";

/**
 * Forwards the email link to a confirm page.
 * The one-time code is exchanged only after the person clicks Continue,
 * so a mail app opening the link does not use it up.
 */
export function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const confirmUrl = new URL(routes.authConfirm, origin);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");

  if (code) {
    confirmUrl.searchParams.set("code", code);
  }
  if (tokenHash) {
    confirmUrl.searchParams.set("token_hash", tokenHash);
  }
  if (type) {
    confirmUrl.searchParams.set("type", type);
  }
  if (error) {
    confirmUrl.searchParams.set("error", error);
  }
  if (next !== routes.home) {
    confirmUrl.searchParams.set("next", next);
  }

  return NextResponse.redirect(confirmUrl);
}
