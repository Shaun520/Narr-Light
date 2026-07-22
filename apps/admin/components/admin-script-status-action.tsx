"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changeScriptStatus } from "@/app/(admin)/scripts/actions";
import type { ScriptStatus } from "@/lib/services/scripts";

const STATUS_OPTIONS: Array<{ value: string; label: string; tone: string }> = [
  { value: "reviewing", label: "送审", tone: "info" },
  { value: "approved", label: "通过", tone: "success" },
  { value: "rejected", label: "驳回", tone: "warning" },
  { value: "taken_down", label: "下架", tone: "error" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  generating: "生成中",
  completed: "已完成",
  archived: "已归档",
  reviewing: "审核中",
  approved: "已通过",
  rejected: "已驳回",
  taken_down: "已下架",
};

/**
 * 剧本状态变更表单。放在剧本详情面板底部，包含目标状态选择、变更原因输入和提交按钮。
 * 所有写操作必须包含 reason 字段（project_memory 强制约束）。
 */
export function AdminScriptStatusForm({
  scriptId,
  currentStatus,
  returnTo,
}: {
  scriptId: string;
  currentStatus: ScriptStatus;
  returnTo: string;
}) {
  const [nextStatus, setNextStatus] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!nextStatus) {
      event.preventDefault();
      window.alert("请选择目标状态");
      return;
    }
    if (nextStatus === currentStatus) {
      event.preventDefault();
      window.alert("目标状态与当前状态相同");
      return;
    }
    const label = STATUS_OPTIONS.find((opt) => opt.value === nextStatus)?.label ?? nextStatus;
    if (!window.confirm(`确认将剧本状态变更为「${label}」？该操作会记录到审计日志。`)) {
      event.preventDefault();
    }
  };

  return (
    <form action={changeScriptStatus} className="script-status-form" onSubmit={handleSubmit}>
      <input name="scriptId" type="hidden" value={scriptId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="script-status-form-row">
        <label className="script-status-label">当前状态</label>
        <span className={`tag tag-${statusTone(currentStatus)}`}>{STATUS_LABELS[currentStatus] ?? currentStatus}</span>
      </div>
      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`next-status-${scriptId}`}>目标状态</label>
        <select
          className="select"
          id={`next-status-${scriptId}`}
          name="nextStatus"
          onChange={(e) => setNextStatus(e.target.value)}
          value={nextStatus}
        >
          <option value="" disabled>请选择</option>
          {STATUS_OPTIONS.map((opt) => (
            <option
              disabled={opt.value === currentStatus}
              key={opt.value}
              value={opt.value}
            >
              {opt.label}{opt.value === currentStatus ? "（当前）" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`reason-${scriptId}`}>变更原因</label>
        <input
          className="input input-wide"
          id={`reason-${scriptId}`}
          name="reason"
          placeholder="必填，会记录到审计日志"
          required
          type="text"
        />
      </div>
      <div className="script-status-form-actions">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-btn primary" disabled={pending} type="submit">
      {pending ? "提交中" : "应用状态变更"}
    </button>
  );
}

function statusTone(status: ScriptStatus): string {
  switch (status) {
    case "completed":
      return "success";
    case "archived":
      return "default";
    case "generating":
      return "info";
    case "reviewing":
      return "info";
    case "approved":
      return "success";
    case "rejected":
      return "warning";
    case "taken_down":
      return "error";
    default:
      return "warning";
  }
}
