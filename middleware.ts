import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ID_TOKEN_COOKIE = "id-token";

export function middleware(request: NextRequest) {
  if (!request.cookies.get(ID_TOKEN_COOKIE)) {
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
