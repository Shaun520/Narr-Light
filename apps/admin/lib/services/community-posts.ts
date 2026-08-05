import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// 状态值需与 supabase/migrations/033_community_posts.sql 中 community_posts.status CHECK 约束保持一致
export type CommunityPostStatus = "draft" | "reviewing" | "published" | "hidden" | "rejected";
export type CommunityPostType = "carpool" | "review" | "guide" | "rec" | "ask" | "talk";

export type AdminCommunityPostFilters = {
  q?: string;
  status?: "all" | CommunityPostStatus;
  type?: "all" | CommunityPostType;
};

export type AdminCommunityPostRow = {
  id: string;
  authorId: string;
  postType: CommunityPostType;
  title: string;
  content: string;
  tags: string[];
  coverTitle: string;
  coverImageUrl: string | null;
  seatFilled: number;
  seatTotal: number;
  likeCount: number;
  commentCount: number;
  status: CommunityPostStatus;
  createdAt: string;
  updatedAt: string;
  author: { id: string; nickname: string; email: string } | null;
};

export type AdminCommunityPostListResult = {
  posts: AdminCommunityPostRow[];
  total: number;
  error?: string;
};

type PostRecord = {
  id: string;
  author_id: string;
  post_type: CommunityPostType;
  title: string;
  content: string;
  tags: string[];
  cover_title: string;
  cover_image_url: string | null;
  seat_filled: number;
  seat_total: number;
  like_count: number;
  comment_count: number;
  status: CommunityPostStatus;
  created_at: string;
  updated_at: string;
};

type UserRecord = {
  id: string;
  nickname: string | null;
  email: string | null;
};

const PAGE_SIZE = 50;

/**
 * 读取社区帖子（含作者昵称/邮箱）。
 * 使用 service-role 聚合：users 表 RLS 仅允许用户查看自己，Admin 需绕过该限制。
 */
export async function getAdminCommunityPosts(
  filters: AdminCommunityPostFilters,
): Promise<AdminCommunityPostListResult> {
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return {
      posts: [],
      total: 0,
      error: "未配置 Supabase service role，无法读取社区内容。",
    };
  }

  let query = supabase
    .from("community_posts")
    .select(
      "id, author_id, post_type, title, content, tags, cover_title, cover_image_url, seat_filled, seat_total, like_count, comment_count, status, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const q = filters.q?.trim();
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.type && filters.type !== "all") {
    query = query.eq("post_type", filters.type);
  }

  const { data, error } = await query;
  if (error) {
    return { posts: [], total: 0, error: error.message };
  }
  const rows = (data ?? []) as unknown as PostRecord[];

  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const authorMap = new Map<string, UserRecord>();
  if (authorIds.length > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, nickname, email")
      .in("id", authorIds);
    for (const user of (userRows ?? []) as unknown as UserRecord[]) {
      authorMap.set(user.id, user);
    }
  }

  const posts: AdminCommunityPostRow[] = rows.map((row) => {
    const author = authorMap.get(row.author_id);
    return {
      id: row.id,
      authorId: row.author_id,
      postType: row.post_type,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      coverTitle: row.cover_title,
      coverImageUrl: row.cover_image_url,
      seatFilled: row.seat_filled,
      seatTotal: row.seat_total,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: author
        ? { id: author.id, nickname: author.nickname || "未命名", email: author.email || "" }
        : null,
    };
  });

  return { posts, total: rows.length };
}

export type AdminUserOption = {
  id: string;
  nickname: string;
  email: string;
};

/** 作者下拉选项（新增帖子时必选，保证 author_id 外键有效）。 */
export async function getAdminUserOptions(): Promise<AdminUserOption[]> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, nickname, email")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return [];
  }

  return ((data ?? []) as unknown as UserRecord[]).map((user) => ({
    id: user.id,
    nickname: user.nickname || "未命名",
    email: user.email || "",
  }));
}
