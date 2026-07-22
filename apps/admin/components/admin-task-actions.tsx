"use client";

import { useFormStatus } from "react-dom";
import {
  cancelAdminGenerationTask,
  retryAdminGenerationTask,
} from "@/app/(admin)/tasks/generation/actions";
import {
  cancelAdminIllustrationTask,
  retryAdminIllustrationTask,
} from "@/app/(admin)/tasks/illustration/actions";

/**
 * 生成任务重试按钮。仅对 failed 状态任务渲染（由 page 控制条件渲染）。
 * 独立 form，避免与批量删除 form 嵌套。
 */
export function AdminGenerationTaskRetryButton({
  taskId,
  returnTo,
}: {
  taskId: string;
  returnTo: string;
}) {
  return (
    <form
      action={retryAdminGenerationTask}
      onSubmit={(event) => {
        if (!window.confirm("确认重试该失败任务？将重置任务状态为等待中，递增重试计数。")) {
          event.preventDefault();
        }
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <SubmitButton label="重试" pendingLabel="重试中" />
    </form>
  );
}

/**
 * 生成任务取消按钮。仅对 pending/running 状态任务渲染。
 */
export function AdminGenerationTaskCancelButton({
  taskId,
  returnTo,
}: {
  taskId: string;
  returnTo: string;
}) {
  return (
    <form
      action={cancelAdminGenerationTask}
      onSubmit={(event) => {
        if (!window.confirm("确认取消该运行中任务？将置为已取消状态，web 端 SSE 流下次写入会因状态机校验失败而停止。")) {
          event.preventDefault();
        }
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <SubmitButton label="取消" pendingLabel="取消中" danger />
    </form>
  );
}

/**
 * 插画任务重试按钮。仅对 failed 状态任务渲染。
 */
export function AdminIllustrationTaskRetryButton({
  taskId,
  returnTo,
}: {
  taskId: string;
  returnTo: string;
}) {
  return (
    <form
      action={retryAdminIllustrationTask}
      onSubmit={(event) => {
        if (!window.confirm("确认重试该失败插画任务？将重置任务状态为等待中。")) {
          event.preventDefault();
        }
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <SubmitButton label="重试" pendingLabel="重试中" />
    </form>
  );
}

/**
 * 插画任务取消按钮。仅对 pending/running 状态任务渲染。
 */
export function AdminIllustrationTaskCancelButton({
  taskId,
  returnTo,
}: {
  taskId: string;
  returnTo: string;
}) {
  return (
    <form
      action={cancelAdminIllustrationTask}
      onSubmit={(event) => {
        if (!window.confirm("确认取消该运行中插画任务？将置为已取消状态。")) {
          event.preventDefault();
        }
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <SubmitButton label="取消" pendingLabel="取消中" danger />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  danger,
}: {
  label: string;
  pendingLabel: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`link-btn${danger ? " danger" : ""}`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
