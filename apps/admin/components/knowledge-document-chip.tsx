"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { AdminDeleteKnowledgeDocumentButton } from "@/components/admin-delete-knowledge-document-button";
import { getKnowledgeDocumentContent } from "@/app/(admin)/knowledge/actions";

type Props = {
  documentId: string;
  title: string;
  statusLabel: string;
  warning?: string;
};

export function KnowledgeDocumentChip({ documentId, title, statusLabel, warning }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleOpen = () => {
    setOpen(true);
    if (content || pending) return;
    startTransition(async () => {
      const result = await getKnowledgeDocumentContent(documentId);
      if (result.error) {
        setError(result.error);
      } else {
        setContent(result.content ?? "");
      }
    });
  };

  return (
    <>
      <span className="knowledge-job knowledge-doc-chip" title="点击查看资料内容">
        <button className="knowledge-doc-chip-btn" type="button" onClick={handleOpen}>
          资料：{title} / {statusLabel}
        </button>
        {warning && (
          <span className="knowledge-doc-warn" title={warning}>
            {warning}
          </span>
        )}
        <AdminDeleteKnowledgeDocumentButton documentId={documentId} title={title} />
      </span>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal knowledge-doc-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">
                <FileText size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                {title}
              </span>
              <button className="link-btn" type="button" onClick={() => setOpen(false)}>
                <X size={14} style={{ verticalAlign: -2, marginRight: 2 }} />
                关闭
              </button>
            </div>
            <div className="modal-body knowledge-doc-modal-body">
              {pending ? (
                <div className="knowledge-doc-loading">
                  <Loader2 size={18} className="spin" />
                  <span>资料内容读取中</span>
                </div>
              ) : error ? (
                <div className="admin-inline-alert" role="alert">
                  {error}
                </div>
              ) : (
                <pre className="knowledge-doc-content">{content}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
