"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Upload } from "lucide-react";
import { uploadKnowledgeDocument } from "@/app/(admin)/knowledge/actions";

export function KnowledgeUploadForm() {
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={uploadKnowledgeDocument} className="knowledge-upload-form" encType="multipart/form-data">
      <input className="input knowledge-upload-title" name="title" placeholder="资料标题（可选，默认使用文件名）" />
      <input
        ref={fileInputRef}
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="选择资料文件"
        className="knowledge-upload-file-input"
        name="file"
        required
        type="file"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <button className="admin-btn" type="button" onClick={() => fileInputRef.current?.click()}>
        <Upload size={14} />
        选择文件
      </button>
      <span className={`knowledge-upload-file-name${fileName ? "" : " empty"}`} title={fileName}>
        {fileName || "未选择文件"}
      </span>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="admin-btn primary" disabled={pending} type="submit">
      {pending ? <Loader2 className="spin" size={14} /> : <Upload size={14} />}
      {pending ? "抽取中..." : "上传并抽取"}
    </button>
  );
}
