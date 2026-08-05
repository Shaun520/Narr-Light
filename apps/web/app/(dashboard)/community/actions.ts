'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  BadgeVariant,
  CardType,
  CategoryKey,
  CommunityPost,
  CoverVariant,
  PostStat,
} from '@/lib/services/community-service';

export interface CommunityFeedFilters {
  category?: CategoryKey;
  chip?: string;
}

export interface CreateCommunityPostInput {
  postType: CardType;
  title: string;
  content: string;
  tags?: string[];
  coverTitle?: string;
  coverImageUrl?: string;
  coverVariant?: CoverVariant;
  seatTotal?: number;
}

const TYPE_META: Record<CardType, { label: string; variant: BadgeVariant }> = {
  carpool: { label: '拼车', variant: 'b-carpool' },
  review: { label: '测评', variant: 'b-review' },
  guide: { label: '攻略', variant: 'b-guide' },
  rec: { label: '推荐', variant: 'b-rec' },
  ask: { label: '求助', variant: 'b-ask' },
  talk: { label: '杂谈', variant: 'b-talk' },
};

/** 相对时间展示，对齐原型的 "· 2h前" 信息 */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

interface CommunityPostRow {
  id: string;
  author_id: string;
  post_type: CardType;
  title: string;
  content: string;
  tags: string[];
  cover_variant: CoverVariant;
  cover_title: string;
  cover_image_url: string | null;
  seat_filled: number;
  seat_total: number;
  like_count: number;
  comment_count: number;
  status: 'draft' | 'reviewing' | 'published' | 'hidden' | 'rejected';
  created_at: string;
}

interface AuthorRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

function mapPost(row: CommunityPostRow, author?: AuthorRow): CommunityPost {
  const meta = TYPE_META[row.post_type];
  const stats: PostStat[] = [
    { type: 'like', count: row.like_count },
    { type: 'comment', count: row.comment_count },
  ];
  const seat =
    row.post_type === 'carpool' && row.seat_total > 0
      ? {
          filled: row.seat_filled,
          total: row.seat_total,
          full: row.seat_filled >= row.seat_total,
        }
      : undefined;
  const authorName = author?.nickname || '创作者';
  return {
    id: row.id,
    type: row.post_type,
    cover: row.cover_title
      ? { variant: row.cover_variant, height: 'h-mid', title: row.cover_title }
      : undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    badge: { label: meta.label, variant: meta.variant },
    title: row.title,
    excerpt:
      row.content.length > 90 ? `${row.content.slice(0, 90)}…` : row.content || undefined,
    tags: row.tags ?? [],
    author: {
      avatarChar: authorName.charAt(0) || '创',
      name: `${authorName} · ${formatRelative(row.created_at)}`,
    },
    stats,
    seat,
    joinLabel: seat ? (seat.full ? '候补排队' : '立即加入') : undefined,
    joinDisabled: seat ? seat.full : undefined,
  };
}

const FILTERABLE_TYPES: ReadonlySet<string> = new Set([
  'carpool',
  'review',
  'guide',
  'talk',
  'ask',
]);

/**
 * 读取社区动态流（已发布帖子 + 作者昵称）。
 * 使用 service-role 读取并只暴露白名单字段：users 表 RLS 仅允许查看自己，
 * 客户端直连无法跨用户取昵称，故走服务端聚合（与 Admin 监控同模式）。
 * recommend/following：MVP 阶段返回全部已发布内容，关注流依赖 follow 关系表（后续迭代）。
 */
export async function getCommunityFeedAction(
  filters?: CommunityFeedFilters,
): Promise<{ posts: CommunityPost[]; error?: string }> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from('community_posts')
      .select(
        'id, author_id, post_type, title, content, tags, cover_variant, cover_title, cover_image_url, seat_filled, seat_total, like_count, comment_count, status, created_at',
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    const category = filters?.category;
    if (category && FILTERABLE_TYPES.has(category)) {
      query = query.eq('post_type', category);
    }
    void filters?.chip; // MVP 阶段 chips 为前端 UI 状态，服务端过滤后续迭代实现

    const { data, error } = await query;
    if (error) {
      return { posts: [], error: error.message };
    }
    const rows = (data ?? []) as unknown as CommunityPostRow[];
    if (rows.length === 0) {
      return { posts: [] };
    }

    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const { data: authorRows } = await admin
      .from('users')
      .select('id, nickname, avatar_url')
      .in('id', authorIds);
    const authorMap = new Map<string, AuthorRow>(
      ((authorRows ?? []) as unknown as AuthorRow[]).map((author) => [author.id, author]),
    );

    return { posts: rows.map((row) => mapPost(row, authorMap.get(row.author_id))) };
  } catch (err) {
    return {
      posts: [],
      error: err instanceof Error ? err.message : '读取社区动态失败',
    };
  }
}

/** 创建社区帖子：作者取自当前会话，走用户级 RLS 写入；默认进入待审（reviewing），由 Admin 审核上架。 */
export async function createCommunityPostAction(
  input: CreateCommunityPostInput,
): Promise<{ post?: CommunityPost; error?: string }> {
  const title = input.title.trim();
  if (!title) {
    return { error: '标题不能为空' };
  }
  if (title.length > 200) {
    return { error: '标题不能超过 200 字' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: '请先登录后再发布' };
  }

  const isCarpool = input.postType === 'carpool';
  const seatTotal = isCarpool ? Math.max(0, Math.min(12, input.seatTotal ?? 0)) : 0;
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: user.id,
      post_type: input.postType,
      title,
      content: input.content?.trim() ?? '',
      tags: input.tags ?? [],
      cover_variant: input.coverVariant ?? 'c1',
      cover_title: input.coverTitle?.trim() ?? '',
      cover_image_url: input.coverImageUrl?.trim() || null,
      seat_filled: isCarpool ? 1 : 0,
      seat_total: seatTotal,
      status: 'reviewing',
    })
    .select(
      'id, author_id, post_type, title, content, tags, cover_variant, cover_title, cover_image_url, seat_filled, seat_total, like_count, comment_count, status, created_at',
    )
    .single();

  if (error) {
    return { error: error.message };
  }

  const row = data as unknown as CommunityPostRow;
  const { data: profile } = await supabase
    .from('users')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();
  return {
    post: mapPost(row, {
      id: user.id,
      nickname: profile?.nickname || user.email?.split('@')[0] || '创作者',
      avatar_url: null,
    }),
  };
}
