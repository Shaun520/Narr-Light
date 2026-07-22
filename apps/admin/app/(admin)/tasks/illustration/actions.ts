"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeReturnTo(value: string) {
  return value.startsWith("/tasks/illustration") ? value : "/tasks/illustration";
}

/**
 * 重试失败的插画任务。
 * 仅对 status='failed' 的任务生效：重置为 pending，清空错误字段与进度。
 * illustration_tasks 表无 retry 字段（与 generation_tasks 不同），重试通过原地重置状态实现。
 * 不在此处触发实际生成，新 pending 任务由用户在前端重新触发。
 */
export async function retryAdminIllustrationTask(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法重试插画任务。");
  }

  const taskId = String(formData.get("taskId") ?? "");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/tasks/illustration"));

  if (!UUID_PATTERN.test(taskId)) {
    redirect(returnTo);
  }

  const { data: previousTask, error: readError } = await supabase
    .from("illustration_tasks")
    .select("id,script_id,task_type,status,progress_percent,error_message,selected_model,selected_ratio,selected_count")
    .eq("id", taskId)
    .maybeSingle();

  if (readError) {
    throw new Error(`读取插画任务失败：${readError.message}`);
  }

  if (!previousTask) {
    redirect(returnTo);
  }

  if (previousTask.status !== "failed") {
    throw new Error(`仅失败任务可重试，当前状态：${previousTask.status}`);
  }

  const { error: updateError } = await supabase
    .from("illustration_tasks")
    .update({
      status: "pending",
      progress_percent: 0,
      error_message: "",
      started_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`重试插画任务失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "illustration_task.retry",
    target_type: "illustration_task",
    target_id: taskId,
    payload: {
      before: previousTask,
      after: { status: "pending" },
    },
    reason: "后台重试失败插画任务",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[illustration-tasks] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/tasks/illustration");
  revalidatePath("/scripts");
  revalidatePath("/audit");
  redirect(returnTo);
}

/**
 * 取消运行中（或等待中）的插画任务。
 * 仅对 status in ('pending','running') 生效，置为 cancelled 并写入 completed_at。
 */
export async function cancelAdminIllustrationTask(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法取消插画任务。");
  }

  const taskId = String(formData.get("taskId") ?? "");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/tasks/illustration"));

  if (!UUID_PATTERN.test(taskId)) {
    redirect(returnTo);
  }

  const { data: previousTask, error: readError } = await supabase
    .from("illustration_tasks")
    .select("id,script_id,task_type,status,progress_percent,selected_model")
    .eq("id", taskId)
    .maybeSingle();

  if (readError) {
    throw new Error(`读取插画任务失败：${readError.message}`);
  }

  if (!previousTask) {
    redirect(returnTo);
  }

  if (previousTask.status !== "pending" && previousTask.status !== "running") {
    throw new Error(`仅等待中或运行中任务可取消，当前状态：${previousTask.status}`);
  }

  const { error: updateError } = await supabase
    .from("illustration_tasks")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`取消插画任务失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "illustration_task.cancel",
    target_type: "illustration_task",
    target_id: taskId,
    payload: {
      before: previousTask,
      after: { status: "cancelled" },
    },
    reason: "后台取消运行中插画任务",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[illustration-tasks] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/tasks/illustration");
  revalidatePath("/scripts");
  revalidatePath("/audit");
  redirect(returnTo);
}
