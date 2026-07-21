import { redirect } from "next/navigation";
import type { AdminRole } from "@narrlight/shared";
import { cookies } from "next/headers";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
};

export const ADMIN_SESSION_COOKIE = "narr_admin_session";
export const ADMIN_SESSION_VALUE = "narr-light-admin";

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (session !== ADMIN_SESSION_VALUE) return null;

  return {
    id: "admin",
    username: "admin",
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
