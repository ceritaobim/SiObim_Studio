import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // 1. Selalu izinkan endpoint publik, aset statis, dan Webhook Telegram
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.webmanifest")
  ) {
    return NextResponse.next();
  }

  // 2. Deteksi apakah request berasal dari lokal (laptop / local network)
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local");

  // Jika di lingkungan lokal, bebas masuk langsung tanpa login
  if (isLocalhost) {
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 3. Lingkungan Ter-Hosting (Cloud / Vercel / Domain Publik)
  const sessionCookie = request.cookies.get("co_studio_hosted_session")?.value;
  const isAuthenticated = sessionCookie === "authenticated_siobim";

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Jika belum login di lingkungan hosting, arahkan ke /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
