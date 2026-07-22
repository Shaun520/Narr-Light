"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAdminGenerationTasks } from "@/app/(admin)/tasks/generation/actions";

// 批量删除 form 的 id，用于让表格内的 checkbox / 单个删除按钮通过 form 属性关联到此 form。
// 这样表格内部不再嵌套 form，retry/cancel 等操作可以用独立 form 渲染在操作列。
const FORM_ID = "admin-generation-task-delete-form";

/**
 * 批量删除按钮栏：独立 form，不再包裹表格。
 * 表格内的 checkbox 通过 form={FORM_ID} 关联到此 form，submit 时 FormData 会包含选中的 taskIds。
 */
export function AdminGenerationTaskDeleteForm({ returnTo }: { returnTo: string }) {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const checked = document.querySelectorAll<HTMLInputElement>(
        'input[name="taskIds"]:checked',
      ).length;
      setSelectedCount(checked);
    };
    updateCount();
    document.addEventListener("change", updateCount);
    return () => document.removeEventListener("change", updateCount);
  }, []);

  return (
    <form
      action={deleteAdminGenerationTasks}
      id={FORM_ID}
      onSubmit={(event) => {
        const submitter = event.nativeEvent.submitter;
        const mode = submitter instanceof HTMLButtonElement ? submitter.value : "bulk";
        const count = mode.startsWith("single:") ? 1 : selectedCount;
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
    </form>
  );
}

export function AdminGenerationTaskSelectAllCheckbox() {
  return (
    <input
      aria-label="全选生成任务"
      className="table-checkbox"
      form={FORM_ID}
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[name="taskIds"]').forEach((checkbox) => {
          checkbox.checked = checked;
        });
        document.dispatchEvent(new Event("change", { bubbles: true }));
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
      form={FORM_ID}
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
