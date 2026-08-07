import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import type { AdminRole, AdminPermission } from "@narrlight/shared";
import { hasAdminPermission } from "@narrlight/shared";
import { cookies } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ADMIN_SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
};

export { ADMIN_SESSION_COOKIE, SESSION_TTL_SECONDS };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 通过 cookie 中的 session token 解析当前管理员。
 * 查询 admin_sessions 表，校验未吊销、未过期、账户有效后返回带角色信息的管理员。
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const tokenHash = hashToken(session);
  const { data } = await supabase
    .from("admin_sessions")
    .select("admin_user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, username, role, is_active")
    .eq("id", data.admin_user_id)
    .single();

  if (!admin || !admin.is_active) return null;

return {
    id: admin.id,
    username: admin.username ?? "",
    role: (admin.role as AdminRole) ?? "super_admin",
  };
}

/** 未登录则重定向到 /login */
export async function requireAdmin(): Promise<AdminUser> {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) {
    redirect("/login");
  }
  return currentAdmin;
}

/**
 * 校验当前管理员是否拥有指定权限；无权限则返回 403 语义。
 * 页面层调用时需在调用处捕获，action 层可直接返回错误。
 */
export async function tryRequirePermission(
  permission: AdminPermission,
): Promise<AdminUser | null> {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  if (!hasAdminPermission(admin.role, permission)) return null;
  return admin;
}

/** 校验权限，无权限则重定向到 /login（前端无权访问时） */
export async function requirePermission(
  permission: AdminPermission,
): Promise<AdminUser> {
  const admin = await tryRequirePermission(permission);
  if (!admin) {
    redirect("/login");
  }
  return admin;
}

/** 生成随机 session token（明文仅存 cookie） */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): boolean {
  try {
    const expected = Buffer.from(storedHash, "hex");
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}