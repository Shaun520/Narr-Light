"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, getAdminSessionValue, ADMIN_USER, ADMIN_PASSWORD } from "@/lib/auth/admin";

export type LoginState = {
  error?: string;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, number[]>();

async function getClientKey(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `admin:${ip}`;
}

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

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    recordFailure(key);
    return { error: "管理员账号或密码错误" };
  }

  failedAttempts.delete(key);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, getAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/dashboard");
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/login");
}