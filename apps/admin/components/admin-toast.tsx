"use client";

import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FADE_OUT_AFTER_MS = 3200;
const REMOVE_AFTER_MS = FADE_OUT_AFTER_MS + 320;

export function AdminToast({ clearParams, message }: { clearParams: string[]; message: string }) {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const router = useRouter();
  const clearKeys = clearParams.join(",");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), FADE_OUT_AFTER_MS);
    const removeTimer = setTimeout(() => {
      setVisible(false);
      // 清掉 URL 里的一次性提示参数，避免刷新后重复弹出
      const params = new URLSearchParams(window.location.search);
      for (const key of clearKeys.split(",")) params.delete(key);
      const query = params.toString();
      router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, { scroll: false });
    }, REMOVE_AFTER_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [clearKeys, router]);

  if (!visible) return null;

  return (
    <div className={`toast toast-success${leaving ? " admin-toast-leaving" : ""}`} role="status">
      <CheckCircle2 size={16} />
      <span>{message}</span>
      <button aria-label="关闭提示" className="toast-close" type="button" onClick={() => setLeaving(true)}>
        <X size={14} />
      </button>
    </div>
  );
}
