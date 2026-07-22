"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { clearAdminAuditLogs } from "@/app/(admin)/audit/actions";

export function AdminClearAuditLogsButton() {
  return (
    <form
      action={clearAdminAuditLogs}
      onSubmit={(event) => {
        const confirmed = window.confirm("确认清空全部审计日志？该操作不可恢复。");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="admin-btn danger" disabled={pending} type="submit">
      <Trash2 size={14} />
      {pending ? "清空中" : "清空日志"}
    </button>
  );
}
