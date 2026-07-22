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

/**
 * 重试失败的生成任务。
 * 仅对 status='failed' 的任务生效：重置为 pending，清空错误字段，递增 retry_count。
 * 不在此处触发实际生成（admin 端无 LLM 调用能力），新 pending 任务由用户在前端重新触发或由后续 worker 拉起。
 */
export async function retryAdminGenerationTask(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法重试生成任务。");
  }

  const taskId = String(formData.get("taskId") ?? "");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/tasks/generation"));

  if (!UUID_PATTERN.test(taskId)) {
    redirect(returnTo);
  }

  const { data: previousTask, error: readError } = await supabase
    .from("generation_tasks")
    .select("id,script_id,task_type,status,progress_percent,error_message,failure_reason,retry_count,max_retries,charged_credits,refund_credits")
    .eq("id", taskId)
    .maybeSingle();

  if (readError) {
    throw new Error(`读取生成任务失败：${readError.message}`);
  }

  if (!previousTask) {
    redirect(returnTo);
  }

  if (previousTask.status !== "failed") {
    throw new Error(`仅失败任务可重试，当前状态：${previousTask.status}`);
  }

  const nextRetryCount = (previousTask.retry_count ?? 0) + 1;
  const { error: updateError } = await supabase
    .from("generation_tasks")
    .update({
      status: "pending",
      progress_percent: 0,
      error_message: null,
      failure_reason: null,
      started_at: null,
      completed_at: null,
      retry_count: nextRetryCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`重试生成任务失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "generation_task.retry",
    target_type: "generation_task",
    target_id: taskId,
    payload: {
      before: previousTask,
      after: { status: "pending", retry_count: nextRetryCount },
    },
    reason: "后台重试失败生成任务",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[generation-tasks] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/tasks/generation");
  revalidatePath("/scripts");
  revalidatePath("/audit");
  redirect(returnTo);
}

/**
 * 取消运行中（或等待中）的生成任务。
 * 仅对 status in ('pending','running') 生效，置为 cancelled 并写入 completed_at。
 * 注意：admin 端无法直接中断 web 端正在进行的 SSE 流，状态变更后 web 端下次写入会因状态机校验失败而停止。
 */
export async function cancelAdminGenerationTask(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法取消生成任务。");
  }

  const taskId = String(formData.get("taskId") ?? "");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/tasks/generation"));

  if (!UUID_PATTERN.test(taskId)) {
    redirect(returnTo);
  }

  const { data: previousTask, error: readError } = await supabase
    .from("generation_tasks")
    .select("id,script_id,task_type,status,progress_percent,charged_credits,refund_credits")
    .eq("id", taskId)
    .maybeSingle();

  if (readError) {
    throw new Error(`读取生成任务失败：${readError.message}`);
  }

  if (!previousTask) {
    redirect(returnTo);
  }

  if (previousTask.status !== "pending" && previousTask.status !== "running") {
    throw new Error(`仅等待中或运行中任务可取消，当前状态：${previousTask.status}`);
  }

  const { error: updateError } = await supabase
    .from("generation_tasks")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`取消生成任务失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "generation_task.cancel",
    target_type: "generation_task",
    target_id: taskId,
    payload: {
      before: previousTask,
      after: { status: "cancelled" },
    },
    reason: "后台取消运行中生成任务",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[generation-tasks] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/tasks/generation");
  revalidatePath("/scripts");
  revalidatePath("/audit");
  redirect(returnTo);
}
