"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 允许的社区帖子目标状态，需与 supabase/migrations/033_community_posts.sql 保持一致
const ALLOWED_STATUSES = ["reviewing", "published", "hidden", "rejected"] as const;
type CommunityReviewStatus = (typeof ALLOWED_STATUSES)[number];

function isReviewStatus(value: string): value is CommunityReviewStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(value);
}

// 新增/编辑可用的完整状态集（含草稿）
const ALL_POST_STATUSES = ["draft", "reviewing", "published", "hidden", "rejected"] as const;
type PostStatusValue = (typeof ALL_POST_STATUSES)[number];

function isPostStatus(value: string): value is PostStatusValue {
  return (ALL_POST_STATUSES as readonly string[]).includes(value);
}

const POST_TYPES = ["carpool", "review", "guide", "rec", "ask", "talk"] as const;
type PostTypeValue = (typeof POST_TYPES)[number];

function isPostType(value: string): value is PostTypeValue {
  return (POST_TYPES as readonly string[]).includes(value);
}

function parseTags(value: string): string[] {
  return value
    .split(/[,，、;；\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseIntSafe(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/** 解析封面图：有上传文件时上传到 community-covers 桶并返回公开 URL，否则保留当前 URL。 */
async function resolveCoverImageUrl(
  supabase: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  formData: FormData,
): Promise<string> {
  const current = String(formData.get("coverImageUrl") ?? "").trim();
  const file = formData.get("coverImage");

  if (!(file instanceof File) || file.size === 0) {
    return current;
  }

  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `community-covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from("community-covers").upload(key, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    throw new Error(`封面图上传失败：${error.message}`);
  }

  const { data } = supabase.storage.from("community-covers").getPublicUrl(key);
  return data.publicUrl;
}

/** 新增社区帖子：管理员选择作者，写入审计日志。 */
export async function createCommunityPost(formData: FormData) {
  const admin = await requirePermission("moderation:write");
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法新增社区帖子。");
  }

  const authorId = String(formData.get("authorId") ?? "");
  const postType = String(formData.get("postType") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const coverTitle = String(formData.get("coverTitle") ?? "").trim();
  const coverImageUrl = await resolveCoverImageUrl(supabase, formData);
  const status = String(formData.get("status") ?? "published");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/moderation/posts"));

  if (!UUID_PATTERN.test(authorId) || !isPostType(postType) || !title || !isPostStatus(status)) {
    redirect(returnTo);
  }

  const isCarpool = postType === "carpool";
  const seatTotal = isCarpool ? Math.min(12, parseIntSafe(formData.get("seatTotal"))) : 0;
  const seatFilled = isCarpool ? Math.min(seatTotal, parseIntSafe(formData.get("seatFilled"))) : 0;

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: authorId,
      post_type: postType,
      title,
      content,
      tags,
      cover_variant: "c1",
      cover_title: coverTitle,
      cover_image_url: coverImageUrl || null,
      seat_filled: seatFilled,
      seat_total: seatTotal,
      status,
    })
    .select("id,title")
    .single();

  if (error) {
    throw new Error(`新增社区帖子失败：${error.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "community_post.create",
    target_type: "community_post",
    target_id: data.id,
    payload: {
      title,
      post_type: postType,
      status,
      author_id: authorId,
    },
    reason: "后台新增社区帖子",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[community-posts] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/moderation/posts");
  redirect(returnTo);
}

/** 编辑社区帖子：更新内容字段与状态，写入审计日志。 */
export async function updateCommunityPost(formData: FormData) {
  const admin = await requirePermission("moderation:write");
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法编辑社区帖子。");
  }

  const postId = String(formData.get("postId") ?? "");
  const postType = String(formData.get("postType") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const coverTitle = String(formData.get("coverTitle") ?? "").trim();
  const coverImageUrl = await resolveCoverImageUrl(supabase, formData);
  const status = String(formData.get("status") ?? "published");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/moderation/posts"));

  if (!UUID_PATTERN.test(postId) || !isPostType(postType) || !title || !isPostStatus(status)) {
    redirect(returnTo);
  }

  const { data: previous, error: readError } = await supabase
    .from("community_posts")
    .select("id,title,status,post_type")
    .eq("id", postId)
    .maybeSingle();

  if (readError || !previous) {
    redirect(returnTo);
  }

  const isCarpool = postType === "carpool";
  const seatTotal = isCarpool ? Math.min(12, parseIntSafe(formData.get("seatTotal"))) : 0;
  const seatFilled = isCarpool ? Math.min(seatTotal, parseIntSafe(formData.get("seatFilled"))) : 0;

  const { error: updateError } = await supabase
    .from("community_posts")
    .update({
      post_type: postType,
      title,
      content,
      tags,
      cover_title: coverTitle,
      cover_image_url: coverImageUrl || null,
      seat_filled: seatFilled,
      seat_total: seatTotal,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) {
    throw new Error(`编辑社区帖子失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "community_post.update",
    target_type: "community_post",
    target_id: postId,
    payload: {
      previous: {
        title: previous.title,
        status: previous.status,
        post_type: previous.post_type,
      },
      next: {
        title,
        status,
        post_type: postType,
      },
    },
    reason: "后台编辑社区帖子",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[community-posts] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/moderation/posts");
  redirect(returnTo);
}

/**
 * 变更社区帖子状态（reviewing/published/hidden/rejected）。
 * 写操作必须携带 reason 字段，并记录到 admin_audit_logs。
 */
export async function changeCommunityPostStatus(formData: FormData) {
  const admin = await requirePermission("moderation:write");
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法变更社区帖子状态。");
  }

  const postId = String(formData.get("postId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/moderation/posts"));

  if (!UUID_PATTERN.test(postId) || !isReviewStatus(nextStatus) || !reason) {
    redirect(returnTo);
  }

  const { data: previous, error: readError } = await supabase
    .from("community_posts")
    .select("id,title,author_id,status")
    .eq("id", postId)
    .maybeSingle();

  if (readError || !previous) {
    redirect(returnTo);
  }

  const { error: updateError } = await supabase
    .from("community_posts")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    throw new Error(`变更社区帖子状态失败：${updateError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "community_post.status_change",
    target_type: "community_post",
    target_id: postId,
    payload: {
      previous_status: previous.status,
      next_status: nextStatus,
      post_title: previous.title,
    },
    reason,
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[community-posts] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/moderation/posts");
  revalidatePath("/moderation");
  redirect(returnTo);
}

/** 删除社区帖子，并记录到 admin_audit_logs。 */
export async function deleteCommunityPost(formData: FormData) {
  const admin = await requirePermission("moderation:write");
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("未配置 Supabase service role，无法删除社区帖子。");
  }

  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/moderation/posts"));

  if (!UUID_PATTERN.test(postId) || !reason) {
    redirect(returnTo);
  }

  const { data: previous, error: readError } = await supabase
    .from("community_posts")
    .select("id,title,author_id,status")
    .eq("id", postId)
    .maybeSingle();

  if (readError || !previous) {
    redirect(returnTo);
  }

  const { error: deleteError } = await supabase.from("community_posts").delete().eq("id", postId);

  if (deleteError) {
    throw new Error(`删除社区帖子失败：${deleteError.message}`);
  }

  const requestHeaders = await headers();
  const { error: auditError } = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "community_post.delete",
    target_type: "community_post",
    target_id: postId,
    payload: {
      deleted_post: previous,
    },
    reason,
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.warn(`[community-posts] 审计日志写入失败：${auditError.message}`);
  }

  revalidatePath("/moderation/posts");
  revalidatePath("/moderation");
  redirect(returnTo);
}

function normalizeReturnTo(value: string) {
  return value.startsWith("/moderation/posts") ? value : "/moderation/posts";
}
