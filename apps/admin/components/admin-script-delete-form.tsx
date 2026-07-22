"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAdminScripts } from "@/app/(admin)/scripts/actions";

// 批量删除 form 的 id，用于让表格内的 checkbox / 单个删除按钮通过 form 属性关联到此 form。
// 这样表格内部不再嵌套 form，状态变更等操作可以用独立 form 渲染在操作列。
const FORM_ID = "admin-script-delete-form";

/**
 * 批量删除按钮栏：独立 form，不再包裹表格。
 * 表格内的 checkbox 通过 form={FORM_ID} 关联到此 form，submit 时 FormData 会包含选中的 scriptIds。
 */
export function AdminScriptDeleteForm({ returnTo }: { returnTo: string }) {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const checked = document.querySelectorAll<HTMLInputElement>(
        'input[name="scriptIds"]:checked',
      ).length;
      setSelectedCount(checked);
    };
    updateCount();
    document.addEventListener("change", updateCount);
    return () => document.removeEventListener("change", updateCount);
  }, []);

  return (
    <form
      action={deleteAdminScripts}
      id={FORM_ID}
      onSubmit={(event) => {
        const submitter = event.nativeEvent.submitter;
        const mode = submitter instanceof HTMLButtonElement ? submitter.value : "bulk";
        const count = mode.startsWith("single:") ? 1 : selectedCount;
        const message =
          count > 1
            ? `确认删除选中的 ${count} 个剧本？关联角色、幕、线索、任务和插画数据会一并删除，且不可恢复。`
            : "确认删除该剧本？关联角色、幕、线索、任务和插画数据会一并删除，且不可恢复。";

        if (count === 0 || !window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="table-bulk-actions">
        <span>已选择 {selectedCount} 个剧本</span>
        <BulkDeleteButton disabled={selectedCount === 0} />
      </div>
    </form>
  );
}

export function AdminScriptSelectAllCheckbox() {
  return (
    <input
      aria-label="全选剧本"
      className="table-checkbox"
      form={FORM_ID}
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[name="scriptIds"]').forEach((checkbox) => {
          checkbox.checked = checked;
        });
        document.dispatchEvent(new Event("change", { bubbles: true }));
      }}
      type="checkbox"
    />
  );
}

export function AdminScriptDeleteButton({ scriptId }: { scriptId: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="link-btn danger"
      disabled={pending}
      form={FORM_ID}
      name="deleteMode"
      type="submit"
      value={`single:${scriptId}`}
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
