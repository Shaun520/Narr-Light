"use client";

import { useTransition } from "react";
import { deleteKnowledgeDocument } from "@/app/(admin)/knowledge/actions";

export function AdminDeleteKnowledgeDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="link-btn danger"
      disabled={pending}
      type="button"
      onClick={() => {
        const confirmed = window.confirm(`确认删除资料「${title}」？其抽取任务和待审候选将一并删除，已入库的知识条目不受影响。`);
        if (!confirmed) return;
        startTransition(async () => {
          await deleteKnowledgeDocument(documentId);
        });
      }}
    >
      {pending ? "删除中" : "删除"}
    </button>
  );
}
