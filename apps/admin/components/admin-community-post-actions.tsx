"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeCommunityPostStatus,
  createCommunityPost,
  deleteCommunityPost,
  updateCommunityPost,
} from "@/app/(admin)/moderation/actions";
import type {
  AdminCommunityPostRow,
  AdminUserOption,
  CommunityPostStatus,
  CommunityPostType,
} from "@/lib/services/community-posts";

const STATUS_OPTIONS: Array<{ value: CommunityPostStatus; label: string }> = [
  { value: "published", label: "上架" },
  { value: "hidden", label: "下架" },
  { value: "rejected", label: "拒绝" },
];

const STATUS_LABELS: Record<CommunityPostStatus, string> = {
  draft: "草稿",
  reviewing: "待审",
  published: "已上架",
  hidden: "已下架",
  rejected: "已拒绝",
};

/**
 * 社区帖子状态变更表单：目标状态 + 变更原因（必填，写入审计日志）。
 */
export function AdminCommunityPostStatusForm({
  postId,
  currentStatus,
  returnTo,
}: {
  postId: string;
  currentStatus: CommunityPostStatus;
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
    if (!window.confirm(`确认将帖子状态变更为「${label}」？该操作会记录到审计日志。`)) {
      event.preventDefault();
    }
  };

  return (
    <form
      action={changeCommunityPostStatus}
      className="script-status-form"
      onSubmit={handleSubmit}
    >
      <input name="postId" type="hidden" value={postId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="script-status-form-row">
        <label className="script-status-label">当前状态</label>
        <span className={`tag tag-${statusTone(currentStatus)}`}>
          {STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>
      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`next-status-${postId}`}>
          目标状态
        </label>
        <select
          className="select"
          id={`next-status-${postId}`}
          name="nextStatus"
          onChange={(e) => setNextStatus(e.target.value)}
          value={nextStatus}
        >
          <option value="" disabled>
            请选择
          </option>
          {STATUS_OPTIONS.map((opt) => (
            <option disabled={opt.value === currentStatus} key={opt.value} value={opt.value}>
              {opt.label}
              {opt.value === currentStatus ? "（当前）" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`reason-${postId}`}>
          变更原因
        </label>
        <input
          className="input input-wide"
          id={`reason-${postId}`}
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

/** 删除帖子按钮（带确认，原因必填并写入审计日志）。 */
export function AdminCommunityPostDeleteButton({
  postId,
  returnTo,
}: {
  postId: string;
  returnTo: string;
}) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm("确认删除该帖子？删除后不可恢复，该操作会记录到审计日志。")) {
      event.preventDefault();
    }
  };

  return (
    <form action={deleteCommunityPost} onSubmit={handleSubmit}>
      <input name="postId" type="hidden" value={postId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`delete-reason-${postId}`}>
          删除原因
        </label>
        <input
          className="input input-wide"
          id={`delete-reason-${postId}`}
          name="reason"
          placeholder="必填，会记录到审计日志"
          required
          type="text"
        />
      </div>
      <div className="script-status-form-actions">
        <DeleteButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-btn primary" disabled={pending} type="submit">
      {pending ? "提交中…" : "应用状态变更"}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-btn danger" disabled={pending} type="submit">
      {pending ? "删除中…" : "删除帖子"}
    </button>
  );
}

const FORM_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "carpool", label: "拼车" },
  { value: "review", label: "测评" },
  { value: "guide", label: "攻略" },
  { value: "rec", label: "推荐" },
  { value: "ask", label: "求助" },
  { value: "talk", label: "杂谈" },
];

const FORM_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "draft", label: "草稿" },
  { value: "reviewing", label: "待审" },
  { value: "published", label: "已上架" },
  { value: "hidden", label: "已下架" },
  { value: "rejected", label: "已拒绝" },
];

/**
 * 社区帖子新增/编辑表单。
 * 新增时作者必选（保证 author_id 外键有效）；编辑时作者不可变更。
 */
export function AdminCommunityPostForm({
  mode,
  post,
  authors,
  returnTo,
}: {
  mode: "create" | "edit";
  post?: AdminCommunityPostRow;
  authors: AdminUserOption[];
  returnTo: string;
}) {
  const [postType, setPostType] = useState<CommunityPostType>(post?.postType ?? "rec");
  const [status, setStatus] = useState<string>(post?.status ?? "published");
  const [previewUrl, setPreviewUrl] = useState(post?.coverImageUrl ?? "");
  const isEdit = mode === "edit";
  const isCarpool = postType === "carpool";
  const suffix = isEdit ? "edit" : "create";

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <form action={isEdit ? updateCommunityPost : createCommunityPost} className="script-status-form">
      <input name="returnTo" type="hidden" value={returnTo} />
      {isEdit && post ? <input name="postId" type="hidden" value={post.id} /> : null}
      {isEdit && post ? <input name="authorId" type="hidden" value={post.authorId} /> : null}

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-author-${suffix}`}>
          作者
        </label>
        {isEdit && post ? (
          <span className="tag tag-info">
            {post.author ? post.author.nickname : "未知作者"}
          </span>
        ) : (
          <select
            className="select input-wide"
            id={`post-author-${suffix}`}
            name="authorId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              请选择作者
            </option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.nickname}（{author.email || "无邮箱"}）
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-type-${suffix}`}>
          类型
        </label>
        <select
          className="select input-wide"
          id={`post-type-${suffix}`}
          name="postType"
          value={postType}
          onChange={(e) => setPostType(e.target.value as CommunityPostType)}
        >
          {FORM_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-title-${suffix}`}>
          标题
        </label>
        <input
          className="input input-wide"
          id={`post-title-${suffix}`}
          name="title"
          defaultValue={post?.title ?? ""}
          maxLength={200}
          required
          type="text"
        />
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-content-${suffix}`}>
          正文
        </label>
        <textarea
          className="textarea input-wide"
          id={`post-content-${suffix}`}
          name="content"
          defaultValue={post?.content ?? ""}
          rows={6}
        />
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-tags-${suffix}`}>
          标签
        </label>
        <input
          className="input input-wide"
          id={`post-tags-${suffix}`}
          name="tags"
          defaultValue={post?.tags.join("，") ?? ""}
          placeholder="多个标签用逗号分隔"
          type="text"
        />
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-cover-title-${suffix}`}>
          封面标题
        </label>
        <input
          className="input input-wide"
          id={`post-cover-title-${suffix}`}
          name="coverTitle"
          defaultValue={post?.coverTitle ?? ""}
          type="text"
        />
      </div>

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-cover-${suffix}`}>
          封面图
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {previewUrl ? (
            <img
              alt="封面预览"
              src={previewUrl}
              style={{ width: 66, height: 92, objectFit: "cover", borderRadius: 6, display: "block" }}
            />
          ) : (
            <span className="placeholder-meta">无封面</span>
          )}
          <input
            accept="image/*"
            id={`post-cover-${suffix}`}
            name="coverImage"
            onChange={handleCoverChange}
            type="file"
          />
        </div>
        <input name="coverImageUrl" type="hidden" value={post?.coverImageUrl ?? ""} />
      </div>

      {isCarpool ? (
        <>
          <div className="script-status-form-row">
            <label className="script-status-label" htmlFor={`post-seat-total-${suffix}`}>
              拼车总人数
            </label>
            <input
              className="input input-wide"
              id={`post-seat-total-${suffix}`}
              name="seatTotal"
              defaultValue={post?.seatTotal ?? 0}
              max={12}
              min={0}
              type="number"
            />
          </div>
          <div className="script-status-form-row">
            <label className="script-status-label" htmlFor={`post-seat-filled-${suffix}`}>
              已占座位
            </label>
            <input
              className="input input-wide"
              id={`post-seat-filled-${suffix}`}
              name="seatFilled"
              defaultValue={post?.seatFilled ?? 0}
              max={12}
              min={0}
              type="number"
            />
          </div>
        </>
      ) : null}

      <div className="script-status-form-row">
        <label className="script-status-label" htmlFor={`post-status-${suffix}`}>
          状态
        </label>
        <select
          className="select input-wide"
          id={`post-status-${suffix}`}
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {FORM_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="script-status-form-actions">
        <FormSubmitButton label={isEdit ? "保存修改" : "创建帖子"} />
      </div>
    </form>
  );
}

function FormSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-btn primary" disabled={pending} type="submit">
      {pending ? "提交中…" : label}
    </button>
  );
}

function statusTone(status: CommunityPostStatus): string {
  switch (status) {
    case "reviewing":
      return "info";
    case "published":
      return "success";
    case "hidden":
      return "warning";
    case "rejected":
      return "error";
    default:
      return "default";
  }
}
