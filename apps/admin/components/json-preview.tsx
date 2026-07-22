"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * JSON 预览组件。
 * 默认折叠显示前 240 字符摘要，点击按钮可展开完整 JSON。
 * 用于 admin 端任务详情中 params / resultData 等字段，便于运营定位失败原因。
 */
export function JsonPreview({ value, label }: { value: unknown; label?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="json-preview-empty">无</span>;
  }

  let text: string;
  try {
    text = JSON.stringify(value, null, expanded ? 2 : 0);
  } catch {
    return <span className="json-preview-empty">无法序列化</span>;
  }

  if (!text) {
    return <span className="json-preview-empty">无</span>;
  }

  // 折叠态：超过 240 字符截断，提供"展开"按钮
  // 展开态：显示完整 JSON，提供"折叠"按钮
  const previewLimit = 240;
  const isLong = text.length > previewLimit;
  const displayText = expanded ? text : isLong ? `${text.slice(0, previewLimit)}...` : text;
  const toggleLabel = expanded ? "折叠" : `展开完整（${text.length.toLocaleString("zh-CN")} 字符）`;

  return (
    <div className="json-preview">
      {label && <div className="json-preview-label">{label}</div>}
      <pre className={`json-preview-text${expanded ? " json-preview-expanded" : ""}`}>{displayText}</pre>
      {isLong && (
        <button
          className="json-preview-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {toggleLabel}
        </button>
      )}
    </div>
  );
}
