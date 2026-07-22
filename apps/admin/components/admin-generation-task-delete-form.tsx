"use client";

import { Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAdminGenerationTasks } from "@/app/(admin)/tasks/generation/actions";

const FORM_ID = "admin-generation-task-delete-form";

export function AdminGenerationTaskDeleteForm({
  returnTo,
  children,
}: {
  returnTo: string;
  children: ReactNode;
}) {
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form
      action={deleteAdminGenerationTasks}
      id={FORM_ID}
      onChange={(event) => {
        setSelectedCount(countSelectedTasks(event.currentTarget));
      }}
      onSubmit={(event) => {
        const submitter = event.nativeEvent.submitter;
        const mode = submitter instanceof HTMLButtonElement ? submitter.value : "bulk";
        const count = mode.startsWith("single:") ? 1 : countSelectedTasks(event.currentTarget);
        const message =
          count > 1
            ? `确认删除选中的 ${count} 个生成任务？该操作只删除任务记录，不会删除剧本内容。`
            : "确认删除该生成任务？该操作只删除任务记录，不会删除剧本内容。";

        if (count === 0 || !window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="table-bulk-actions">
        <span>已选择 {selectedCount} 个生成任务</span>
        <BulkDeleteButton disabled={selectedCount === 0} />
      </div>
      {children}
    </form>
  );
}

export function AdminGenerationTaskSelectAllCheckbox() {
  return (
    <input
      aria-label="全选生成任务"
      className="table-checkbox"
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;

        const checked = event.currentTarget.checked;
        form.querySelectorAll<HTMLInputElement>('input[name="taskIds"]').forEach((checkbox) => {
          checkbox.checked = checked;
        });
        form.dispatchEvent(new Event("change", { bubbles: true }));
      }}
      type="checkbox"
    />
  );
}

export function AdminGenerationTaskDeleteButton({ taskId }: { taskId: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="link-btn danger"
      disabled={pending}
      name="deleteMode"
      type="submit"
      value={`single:${taskId}`}
    >
      {pending ? "删除中" : "删除"}
    </button>
  );
}

function BulkDeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="admin-btn danger"
      disabled={disabled || pending}
      name="deleteMode"
      type="submit"
      value="bulk"
    >
      <Trash2 size={14} />
      {pending ? "删除中" : "批量删除"}
    </button>
  );
}

function countSelectedTasks(form: HTMLFormElement) {
  return form.querySelectorAll<HTMLInputElement>('input[name="taskIds"]:checked').length;
}
