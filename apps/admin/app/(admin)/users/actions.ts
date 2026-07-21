"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  revalidatePath("/users");
  redirect(returnTo.startsWith("/users") ? returnTo : "/users");
}
