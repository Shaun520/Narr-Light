import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/constants";

// 说明: Edge middleware 无法访问数据库，无法校验 session 真伪，
// 这里只做粗筛：无 cookie 时直接重定向登录页；有 cookie 时放行，
// 最终的有效性校验由 (admin) 布局内的 requireAdmin() 完成（会重定向无效会话）。
// 注意：不做"有 cookie 访问 /login 就跳 dashboard"，否则残留的无效 cookie
// 会把 /login 与 /dashboard 之间形成 307 死循环（DB 校验在 middleware 之后才会发生）。
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!hasSessionCookie && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
