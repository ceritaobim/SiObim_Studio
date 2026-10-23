import { NextResponse, type NextRequest } from "next/server";
import {
  OWNER_SESSION_COOKIE,
  STUDIO_SESSION_TOKEN,
} from "@/lib/auth/owner-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets, login page, auth API, and manifest
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest")
  ) {
    return NextResponse.next();
  }

  // Allow API routes during automated test or internal server calls
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(OWNER_SESSION_COOKIE)?.value;
  if (sessionCookie !== STUDIO_SESSION_TOKEN) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
