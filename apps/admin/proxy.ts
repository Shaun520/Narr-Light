import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionValue, hasAdminCredentials } from "@/lib/auth/admin";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasAdminSession =
    hasAdminCredentials() &&
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value === getAdminSessionValue();

  if (!hasAdminSession && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasAdminSession && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
