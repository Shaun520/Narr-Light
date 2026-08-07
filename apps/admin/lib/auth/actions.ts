"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import {
  createSessionToken,
  getSalt,
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type LoginState = {
  error?: string;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

async function getClientKey(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `admin:${ip}`;
}

const failedAttempts = new Map<string, number[]>();

function isLocked(key: string): boolean {
  const now = Date.now();
  const attempts = (failedAttempts.get(key) ?? []).filter((t) => now - t < LOCK_WINDOW_MS);
  failedAttempts.set(key, attempts);
  return attempts.length >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const attempts = (failedAttempts.get(key) ?? []).filter((t) => now - t < LOCK_WINDOW_MS);
  attempts.push(now);
  failedAttempts.set(key, attempts);
}

export async function signInAdmin(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const key = await getClientKey();
  if (isLocked(key)) {
    return { error: "尝试次数过多，请 15 分钟后再试" };
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "请输入管理员账号和密码" };
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { error: "服务未配置，请联系管理员" };
  }

  // 首次引导：admin_users 为空时，用环境变量凭据创建初始 super_admin 账户。
  // 仅在完全无账户时启用，避免环境变量变更影响既有账户。
  const { count, error: countError } = await supabase
    .from("admin_users")
    .select("id", { count: "exact", head: true });
  if (countError) {
    return { error: "服务异常，请联系管理员" };
  }
  if (count === 0) {
    const bootstrapUsername = process.env.ADMIN_USERNAME?.trim() || "admin";
    const bootstrapPassword = process.env.ADMIN_PASSWORD?.trim();
    if (bootstrapUsername === username && bootstrapPassword) {
      const salt = getSalt();
      const { error: seedError } = await supabase.from("admin_users").insert({
        username: bootstrapUsername,
        email: `${bootstrapUsername}@narrlight.local`,
        password_hash: `${salt}:${hashPassword(bootstrapPassword, salt)}`,
        role: "super_admin",
        is_active: true,
        display_name: "初始管理员",
        password_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (seedError) {
        return { error: "初始化管理员账户失败" };
      }
    } else {
      recordFailure(key);
      return { error: "管理员账号或密码错误" };
    }
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, username, password_hash, is_active, failed_login_count, locked_until_at")
    .eq("username", username)
    .single();

  if (!admin || !admin.password_hash || !admin.is_active) {
    recordFailure(key);
    return { error: "管理员账号或密码错误" };
  }

  if (admin.locked_until_at && new Date(admin.locked_until_at).getTime() > Date.now()) {
    return { error: "账号已被锁定，请稍后再试" };
  }

  const [salt, storedHash] = String(admin.password_hash).split(":", 2);
  if (!salt || !storedHash || !verifyPassword(password, storedHash, salt)) {
    recordFailure(key);
    const failedCount = (admin.failed_login_count ?? 0) + 1;
    await supabase
      .from("admin_users")
      .update({
        failed_login_count: failedCount,
        locked_until_at:
          failedCount >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCK_WINDOW_MS).toISOString()
            : admin.locked_until_at,
      })
      .eq("id", admin.id);
    return { error: "管理员账号或密码错误" };
  }

  failedAttempts.delete(key);
  await supabase.from("admin_users").update({
    failed_login_count: 0,
    locked_until_at: null,
    last_login_at: new Date().toISOString(),
  }).eq("id", admin.id);

  const token = createSessionToken();
  const { error: sessionError } = await supabase.from("admin_sessions").insert({
    admin_user_id: admin.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    last_used_at: new Date().toISOString(),
  });
  if (sessionError) {
    return { error: "登录失败，请稍后再试" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect("/dashboard");
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    const supabase = createAdminSupabaseClient();
    if (supabase) {
      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", hashToken(token));
    }
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/login");
}

// 供吊销指定管理员全部会话使用
export async function revokeAdminSessions(adminUserId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return;
  await supabase
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("admin_user_id", adminUserId);
}