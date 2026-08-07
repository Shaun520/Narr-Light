import { redirect } from "next/navigation";
import type { AdminRole } from "@narrlight/shared";
import { cookies } from "next/headers";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
};

export const ADMIN_SESSION_COOKIE = "narr_admin_session";

export const ADMIN_USER = process.env.ADMIN_USERNAME?.trim() || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "";

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET?.trim() || "";

export function getAdminSessionValue(): string {
  if (!ADMIN_PASSWORD) {
    throw new Error("未配置 ADMIN_PASSWORD 环境变量，请先配置管理员口令");
  }
  if (!ADMIN_SESSION_SECRET) {
    throw new Error("未配置 ADMIN_SESSION_SECRET 环境变量，请先配置会话秘钥");
  }
  return `${ADMIN_SESSION_SECRET}:${ADMIN_PASSWORD}`.slice(0, 400);
}

export function hasAdminCredentials(): boolean {
  return Boolean(ADMIN_SESSION_SECRET) && Boolean(ADMIN_PASSWORD);
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!session) return null;
  try {
    if (session !== getAdminSessionValue()) return null;
  } catch {
    return null;
  }

  return {
    id: "admin",
    username: ADMIN_USER,
    role: "super_admin",
  };
}

export async function requireAdmin(): Promise<AdminUser> {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect("/login");
  }

  return currentAdmin;
}