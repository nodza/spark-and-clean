import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/accessControl";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sessionJwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets / Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // /dashboard → /portal (preserve query)
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/dashboard/, "/portal") || "/portal";
    return NextResponse.redirect(url);
  }

  const access = canAccessPath(session, pathname);
  if (!access.ok) {
    return NextResponse.redirect(new URL(access.redirectTo, request.url));
  }

  // Serve existing dashboard UI at /portal (no new page tree)
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/portal/, "/dashboard") || "/dashboard";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  /**
   * Page routes only. API handlers enforce their own auth.
   * Running this middleware on `/api/*` (with request header overrides) was
   * causing nested App Router handlers (`/api/auth/*`, `/api/bookings/[id]`,
   * `/api/admin/*`) to fall through to the HTML 404 page.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api(?:/|$)).*)",
  ],
};
