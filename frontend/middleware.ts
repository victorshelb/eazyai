import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/train", "/history", "/settings", "/results", "/explore"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("eazyai_token")?.value;
  const isProtected = PROTECTED.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !token) {
    const url = new URL("/login", request.url);
    const fullPath = request.nextUrl.pathname + request.nextUrl.search;
    url.searchParams.set("redirect", fullPath);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/train/:path*", "/history/:path*", "/settings/:path*", "/results/:path*", "/explore/:path*"],
};
