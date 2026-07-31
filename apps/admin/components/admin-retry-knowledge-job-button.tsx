"use client";

import { useTransition } from "react";
import { retryKnowledgeExtraction } from "@/app/(admin)/knowledge/actions";

export function AdminRetryKnowledgeJobButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="link-btn"
      disabled={pending}
      type="button"
      onClick={() => {
        startTransition(async () => {
          await retryKnowledgeExtraction(jobId);
        });
      }}
    >
      {pending ? "重试中" : "重试"}
    </button>
  );
}
