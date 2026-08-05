import Link from "next/link";
import { AdminFilterForm } from "@/components/admin-filter-form";
import { AdminCommunityPostCover } from "@/components/admin-community-post-cover";
import {
  AdminCommunityPostDeleteButton,
  AdminCommunityPostForm,
  AdminCommunityPostStatusForm,
} from "@/components/admin-community-post-actions";
import {
  DetailModal,
  DetailPreview,
  PageHeader,
  Tag,
  UserCell,
} from "@/components/admin-static";
import {
  getAdminCommunityPosts,
  getAdminUserOptions,
  type AdminCommunityPostRow,
  type AdminUserOption,
  type CommunityPostStatus,
  type CommunityPostType,
} from "@/lib/services/community-posts";

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  postId?: string;
  action?: string;
  editId?: string;
};

const POST_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "reviewing", label: "待审" },
  { value: "published", label: "已上架" },
  { value: "hidden", label: "已下架" },
  { value: "rejected", label: "已拒绝" },
  { value: "draft", label: "草稿" },
];

const POST_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "carpool", label: "拼车" },
  { value: "review", label: "测评" },
  { value: "guide", label: "攻略" },
  { value: "rec", label: "推荐" },
  { value: "ask", label: "求助" },
  { value: "talk", label: "杂谈" },
];

export default async function CommunityPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const result = await getAdminCommunityPosts(filters);
  const selected = result.posts.find((post) => post.id === params.postId) ?? null;
  const editingPost = result.posts.find((post) => post.id === params.editId) ?? null;
  const userOptions: AdminUserOption[] =
    params.action === "new" ? await getAdminUserOptions() : [];

  return (
    <div className="page-stack">
      <PageHeader
        title="社区内容"
        description="审核并控制创作社区帖子的展示：通过（上架）后才会出现在 Web 端动态流。"
        actions={
          <Link className="admin-btn primary" href={buildNewHref(filters)}>
            新增
          </Link>
        }
      />

      <section className="admin-card">
        <AdminFilterForm action="/moderation/posts">
          <div className="toolbar-left">
            <input
              className="input input-wide"
              name="q"
              placeholder="搜索帖子标题 / 作者 / ID"
              defaultValue={filters.q}
            />
            <select className="select" name="status" defaultValue={filters.status}>
              {POST_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select className="select" name="type" defaultValue={filters.type}>
              {POST_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button className="admin-btn primary" type="submit">
              查询
            </button>
            <Link className="admin-btn" href="/moderation/posts">
              重置
            </Link>
          </div>
        </AdminFilterForm>

        {result.error && (
          <div className="admin-inline-alert" role="alert">
            {result.error}
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>封面</th>
                <th>内容</th>
                <th>类型</th>
                <th>作者</th>
                <th>标签</th>
                <th>互动</th>
                <th>发布时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {result.posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    {post.coverImageUrl ? (
                      <AdminCommunityPostCover alt={post.title} src={post.coverImageUrl} />
                    ) : (
                      <span className="placeholder-meta">无</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <b>{post.title}</b>
                      {post.content ? (
                        <div className="placeholder-meta">{truncate(post.content, 40)}</div>
                      ) : null}
                    </div>
                  </td>
                  <td>{typeTag(post.postType)}</td>
                  <td>
                    {post.author ? (
                      <UserCell
                        avatar={avatarText(post)}
                        name={post.author.nickname}
                        sub={post.author.email || shortId(post.author.id)}
                      />
                    ) : (
                      <span className="placeholder-meta">作者不存在</span>
                    )}
                  </td>
                  <td>
                    {post.tags.length > 0 ? (
                      post.tags.join(" / ")
                    ) : (
                      <span className="placeholder-meta">-</span>
                    )}
                  </td>
                  <td>
                    {post.postType === "carpool"
                      ? `座位 ${post.seatFilled}/${post.seatTotal}`
                      : `赞 ${post.likeCount} / 评 ${post.commentCount}`}
                  </td>
                  <td>{formatDateTime(post.createdAt)}</td>
                  <td>{statusTag(post.status)}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="link-btn" href={buildEditHref(filters, post.id)}>
                        编辑
                      </Link>
                      <Link className="link-btn" href={buildPostHref(filters, post.id)}>
                        详情
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {result.posts.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={9}>
                    暂无匹配内容
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span className="page-total">
            共 {result.total.toLocaleString("zh-CN")} 条，当前显示 {result.posts.length} 条
          </span>
        </div>
      </section>

      {params.action === "new" ? (
        <DetailModal closeHref={buildReturnHref(filters)} title="新增社区帖子">
          <AdminCommunityPostForm
            authors={userOptions}
            mode="create"
            returnTo={buildReturnHref(filters)}
          />
        </DetailModal>
      ) : editingPost ? (
        <DetailModal closeHref={buildReturnHref(filters)} title="编辑社区帖子">
          <AdminCommunityPostForm
            authors={userOptions}
            mode="edit"
            post={editingPost}
            returnTo={buildReturnHref(filters)}
          />
        </DetailModal>
      ) : selected ? (
        <DetailModal closeHref={buildReturnHref(filters)} title="社区帖子详情">
          <CommunityPostDetail post={selected} returnTo={buildReturnHref(filters)} />
        </DetailModal>
      ) : null}
    </div>
  );
}

function CommunityPostDetail({
  post,
  returnTo,
}: {
  post: AdminCommunityPostRow;
  returnTo: string;
}) {
  const interaction =
    post.postType === "carpool"
      ? `座位 ${post.seatFilled} / ${post.seatTotal}`
      : `赞 ${post.likeCount} / 评 ${post.commentCount}`;

  return (
    <>
      <DetailPreview
        title="帖子详情"
        rows={[
          ["标题", post.title],
          [
            "作者",
            post.author
              ? `${post.author.nickname} / ${post.author.email || shortId(post.author.id)}`
              : "作者不存在",
          ],
          ["类型", typeTag(post.postType)],
          ["状态", statusTag(post.status)],
          ["标签", post.tags.length > 0 ? post.tags.join(" / ") : "无"],
          ["正文", post.content || "无正文"],
          [post.postType === "carpool" ? "拼车座位" : "互动统计", interaction],
          ["封面标题", post.coverTitle || "无"],
          [
            "封面图",
            post.coverImageUrl ? (
              <img
                alt={post.title}
                key="cover"
                src={post.coverImageUrl}
                style={{ maxWidth: 140, maxHeight: 180, borderRadius: 6, display: "block" }}
              />
            ) : (
              "无"
            ),
          ],
          ["创建时间", formatDateTime(post.createdAt)],
          ["更新时间", formatDateTime(post.updatedAt)],
        ]}
      />
      <section className="admin-card script-status-card">
        <div className="admin-card-head">
          <div className="admin-card-title">审核操作</div>
        </div>
        <div className="admin-card-body">
          <AdminCommunityPostStatusForm
            currentStatus={post.status}
            postId={post.id}
            returnTo={returnTo}
          />
          <AdminCommunityPostDeleteButton postId={post.id} returnTo={returnTo} />
        </div>
      </section>
    </>
  );
}

function normalizeFilters(params: SearchParams) {
  return {
    q: params.q?.trim() ?? "",
    status: isCommunityPostStatus(params.status) ? params.status : "all",
    type: isCommunityPostType(params.type) ? params.type : "all",
  } as const;
}

function buildPostHref(filters: ReturnType<typeof normalizeFilters>, postId: string) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  params.set("postId", postId);

  return `/moderation/posts?${params.toString()}`;
}

function buildNewHref(filters: ReturnType<typeof normalizeFilters>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  params.set("action", "new");

  return `/moderation/posts?${params.toString()}`;
}

function buildEditHref(filters: ReturnType<typeof normalizeFilters>, postId: string) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  params.set("editId", postId);

  return `/moderation/posts?${params.toString()}`;
}

function buildReturnHref(filters: ReturnType<typeof normalizeFilters>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  const query = params.toString();

  return query ? `/moderation/posts?${query}` : "/moderation/posts";
}

function statusTag(status: CommunityPostStatus) {
  const meta: Record<CommunityPostStatus, { label: string; tone: "default" | "success" | "warning" | "error" | "info" }> = {
    draft: { label: "草稿", tone: "default" },
    reviewing: { label: "待审", tone: "info" },
    published: { label: "已上架", tone: "success" },
    hidden: { label: "已下架", tone: "warning" },
    rejected: { label: "已拒绝", tone: "error" },
  };
  const item = meta[status];
  return <Tag tone={item.tone}>{item.label}</Tag>;
}

function typeTag(type: CommunityPostType) {
  const meta: Record<CommunityPostType, { label: string; tone: "default" | "info" | "warning" | "purple" }> = {
    carpool: { label: "拼车", tone: "info" },
    review: { label: "测评", tone: "warning" },
    guide: { label: "攻略", tone: "purple" },
    rec: { label: "推荐", tone: "default" },
    ask: { label: "求助", tone: "warning" },
    talk: { label: "杂谈", tone: "default" },
  };
  const item = meta[type];
  return <Tag tone={item.tone}>{item.label}</Tag>;
}

function isCommunityPostStatus(value?: string): value is CommunityPostStatus {
  return (
    value === "draft" ||
    value === "reviewing" ||
    value === "published" ||
    value === "hidden" ||
    value === "rejected"
  );
}

function isCommunityPostType(value?: string): value is CommunityPostType {
  return (
    value === "carpool" ||
    value === "review" ||
    value === "guide" ||
    value === "rec" ||
    value === "ask" ||
    value === "talk"
  );
}

function avatarText(post: AdminCommunityPostRow) {
  return (post.author?.nickname || post.author?.email || "作").slice(0, 1).toUpperCase();
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
