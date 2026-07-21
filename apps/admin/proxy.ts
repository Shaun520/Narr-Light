import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE } from "@/lib/auth/admin";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasAdminSession =
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_VALUE;

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
