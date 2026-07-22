"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export async function deleteAdminGenerationTasks(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法删除生成任务。");
  }

  const deleteMode = String(formData.get("deleteMode") ?? "bulk");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/tasks/generation"));
  const taskIds = resolveTaskIds(formData, deleteMode);

  if (taskIds.length === 0) {
    redirect(returnTo);
  }

  const { data: previousTasks, error: readError } = await supabase
    .from("generation_tasks")
    .select("id,script_id,task_type,status,progress_percent,charged_credits,refund_credits,created_at")
    .in("id", taskIds);

  if (readError) {
    throw new Error(`读取待删除生成任务失败：${readError.message}`);
  }

  if (!previousTasks || previousTasks.length === 0) {
    redirect(returnTo);
  }

  const idsToDelete = previousTasks.map((task) => task.id);
  const { error: deleteError } = await supabase.from("generation_tasks").delete().in("id", idsToDelete);

  if (deleteError) {
    throw new Error(`删除生成任务失败：${deleteError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: idsToDelete.length > 1 ? "generation_tasks.bulk_delete" : "generation_task.delete",
    target_type: "generation_task",
    target_id: idsToDelete.length === 1 ? idsToDelete[0] : null,
    payload: {
      deleted_count: idsToDelete.length,
      deleted_tasks: previousTasks,
    },
    reason: idsToDelete.length > 1 ? "后台批量删除生成任务" : "后台删除生成任务",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[generation-tasks] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/tasks/generation");
  revalidatePath("/scripts");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
  redirect(returnTo);
}

function resolveTaskIds(formData: FormData, deleteMode: string) {
  if (deleteMode.startsWith("single:")) {
    return normalizeTaskIds([deleteMode.slice("single:".length)]);
  }

  return normalizeTaskIds(formData.getAll("taskIds").map(String));
}

function normalizeTaskIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => UUID_PATTERN.test(value)))].slice(0, 100);
}

function normalizeReturnTo(value: string) {
  return value.startsWith("/tasks/generation") ? value : "/tasks/generation";
}
