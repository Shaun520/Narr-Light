"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { clearKnowledgeUsageRecords } from "@/app/(admin)/knowledge/actions";

export function AdminClearKnowledgeRecordsButton({ disabled }: { disabled: boolean }) {
  return (
    <form
      action={clearKnowledgeUsageRecords}
      onSubmit={(event) => {
        const confirmed = window.confirm("确认清空全部知识引用和质检记录？该操作不会删除知识条目，但记录清空后不可恢复。");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="admin-btn danger" disabled={disabled || pending} type="submit">
      <Trash2 size={14} />
      {pending ? "清空中" : "清空记录"}
    </button>
  );
}
