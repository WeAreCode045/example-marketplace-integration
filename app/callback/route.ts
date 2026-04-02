import { computeDashboardDestination } from "@/lib/callback-destination";
import { exchangeCodeForToken } from "@/lib/vercel/marketplace-api";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSession } from "../dashboard/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return toComplete(request, { error: "missing_code" });
  }

  const state = request.nextUrl.searchParams.get("state");

  try {
    const token = await exchangeCodeForToken(code, state);
    await createSession(token);
  } catch {
    return toComplete(request, { error: "sso_failed" });
  }

  const nextPath = computeDashboardDestination(request.nextUrl.searchParams);
  return toComplete(request, { next: nextPath });
}

function toComplete(
  request: NextRequest,
  query: { error: string } | { next: string },
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/callback/complete";
  url.search = "";
  if ("error" in query) {
    url.searchParams.set("error", query.error);
  } else {
    url.searchParams.set("next", query.next);
  }
  return NextResponse.redirect(url);
}
