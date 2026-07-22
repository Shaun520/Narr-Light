"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function clearAdminAuditLogs() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法清空审计日志。");
  }

  const { error } = await supabase
    .from("admin_audit_logs")
    .delete()
    .not("id", "is", null);

  if (error) {
    throw new Error(`清空审计日志失败：${error.message}`);
  }

  revalidatePath("/audit");
  redirect("/audit");
}
