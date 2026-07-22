"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function toggleUserBanStatus(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法更新用户状态。");
  }

  const userId = String(formData.get("userId") ?? "");
  const nextIsBanned = String(formData.get("nextIsBanned")) === "true";
  const returnTo = String(formData.get("returnTo") ?? "/users");

  if (!userId) {
    throw new Error("缺少用户 ID。");
  }

  const { data: previousUser } = await supabase
    .from("users")
    .select("id,email,nickname,is_banned,banned_at,banned_reason,banned_by")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("users")
    .update({
      is_banned: nextIsBanned,
      banned_at: nextIsBanned ? new Date().toISOString() : null,
      banned_reason: nextIsBanned ? "后台手动封禁" : null,
      banned_by: nextIsBanned ? admin.username : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`更新用户状态失败：${error.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: nextIsBanned ? "user.ban" : "user.unban",
    target_type: "user",
    target_id: userId,
    payload: {
      before: previousUser ?? null,
      after: {
        is_banned: nextIsBanned,
        banned_reason: nextIsBanned ? "后台手动封禁" : null,
        banned_by: nextIsBanned ? admin.username : null,
      },
    },
    reason: nextIsBanned ? "后台手动封禁" : "后台手动启用",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[users] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/users");
  revalidatePath("/audit");
  redirect(returnTo.startsWith("/users") ? returnTo : "/users");
}
