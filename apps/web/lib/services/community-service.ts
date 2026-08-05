/**
 * 社区侧栏聚合服务
 *
 * 提供创作社区（视图9）侧栏聚合数据的读取能力：
 * - 热门话题、推荐作者、热门剧本榜、社区脉搏统计
 *
 * 帖子动态流已接入真实 community_posts（见 app/(dashboard)/community/actions.ts），
 * 本模块保留的开发期 Mock 仅覆盖尚无聚合统计表的侧栏数据。
 */

// ===================== 通用类型 =====================

/** 创作社区视角 */
export type Perspective = "creator" | "player";

/** 社区分类 key（与 category-tabs 的 data-cat 对齐） */
export type CategoryKey =
  | "recommend"
  | "carpool"
  | "review"
  | "guide"
  | "talk"
  | "ask"
  | "following";

/** 卡片业务类型 */
export type CardType = "carpool" | "review" | "guide" | "rec" | "ask" | "talk";

/** 封面渐变变体（对应 CSS .c1 ~ .c8） */
export type CoverVariant = "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8";

/** 封面高度档位 */
export type CoverHeight = "h-tall" | "h-mid" | "h-short";

/** 徽标样式变体（对应 CSS .b-rec / .b-carpool / ...） */
export type BadgeVariant =
  | "b-rec"
  | "b-carpool"
  | "b-guide"
  | "b-review"
  | "b-talk"
  | "b-ask";

/** 互动统计类型 */
export type StatType = "like" | "comment" | "star";

// ===================== 数据结构 =====================

/** 作者简要信息 */
export interface AuthorBrief {
  /** 头像首字 */
  avatarChar: string;
  /** 作者名（含时间，如 "苏沐 · 2h前"） */
  name: string;
  /** 是否已认证 */
  verified?: boolean;
}

/** 单条互动统计 */
export interface PostStat {
  type: StatType;
  count: number;
  /** 仅 like 类型用：是否已点赞 */
  liked?: boolean;
}

/** 拼车座位进度 */
export interface SeatInfo {
  filled: number;
  total: number;
  /** 是否已满员（满员变绿） */
  full?: boolean;
}

/** 封面信息（纯文字卡无封面） */
export interface CoverInfo {
  variant: CoverVariant;
  height: CoverHeight;
  title: string;
}

/** 社区内容（瀑布流卡片数据） */
export interface CommunityPost {
  id: string;
  /** 卡片业务类型 */
  type: CardType;
  /** 是否为纯文字卡（无封面） */
  isTextCard?: boolean;
  /** 封面（纯文字卡为空） */
  cover?: CoverInfo;
  /** 封面图 URL（可选，展示真实图片；缺失时用 CSS 渐变封面） */
  coverImageUrl?: string;
  /** 徽标 */
  badge: { label: string; variant: BadgeVariant };
  /** 角标（如 "急招 2人" / "DM 必读"） */
  stamp?: string;
  /** 标题（2 行截断） */
  title: string;
  /** 摘要（2 行截断） */
  excerpt?: string;
  /** 标签 */
  tags: string[];
  /** 作者 */
  author: AuthorBrief;
  /** 互动统计（与 joinLabel 互斥） */
  stats?: PostStat[];
  /** 拼车座位进度 */
  seat?: SeatInfo;
  /** 加入按钮文案（与 stats 互斥） */
  joinLabel?: string;
  /** 加入按钮是否禁用（如 "候补排队"） */
  joinDisabled?: boolean;
}

/** 社区脉搏单条 */
export interface PulseStat {
  num: string;
  lbl: string;
}

/** 热门话题 */
export interface CommunityTopic {
  rank: number;
  name: string;
  /** 热度数值（如 "2.4w"） */
  hot?: string;
  /** 标签（如 "热"） */
  tag?: string;
}

/** 推荐作者 */
export interface RecommendedAuthor {
  avatarChar: string;
  /** 头像背景 CSS（inline style 用） */
  avatarBg: string;
  name: string;
  verified?: boolean;
  meta: string;
  followed?: boolean;
}

/** 热门剧本榜条目 */
export interface RankScript {
  /** 序号展示文本（如 "01"） */
  no: string;
  rank: number;
  /** 封面背景 CSS（inline style 用） */
  coverBg: string;
  name: string;
  sub: string;
}

const MOCK_PULSE: PulseStat[] = [
  { num: "37", lbl: "今日新发行" },
  { num: "126", lbl: "在线拼车局" },
  { num: "489", lbl: "24H 评价" },
  { num: "214", lbl: "活跃创作者" },
];

const MOCK_TOPICS: CommunityTopic[] = [
  { rank: 1, name: "#雾港夜话真凶解读", tag: "热" },
  { rank: 2, name: "#长安十二时辰谜线索断点", hot: "2.4w" },
  { rank: 3, name: "#新手DM带本指南", hot: "1.8w" },
  { rank: 4, name: "#古风本伏笔尺度", hot: "9.6k" },
  { rank: 5, name: "#上海长期车友招募", hot: "7.2k" },
  { rank: 6, name: "#星轨彼端新手车", hot: "5.1k" },
];

const MOCK_AUTHORS: RecommendedAuthor[] = [
  {
    avatarChar: "沈",
    avatarBg: "linear-gradient(135deg,var(--gold),var(--blood))",
    name: "沈墨白",
    verified: true,
    meta: "情感/民国 · 4 部 · 1.2w 粉",
  },
  {
    avatarChar: "青",
    avatarBg: "linear-gradient(135deg,#3a6b4a,#1f3a2b)",
    name: "青衫客",
    meta: "硬核/古风 · 7 部 · 8.6k 粉",
  },
  {
    avatarChar: "夜",
    avatarBg: "linear-gradient(135deg,#3a5266,#1f2e3a)",
    name: "夜行者",
    meta: "悬疑/现代 · 5 部 · 5.4k 粉",
    followed: true,
  },
];

const MOCK_RANK: RankScript[] = [
  {
    no: "01",
    rank: 1,
    coverBg:
      "linear-gradient(135deg,rgba(58,42,26,0.5),rgba(26,20,16,0.7)),url('https://picsum.photos/seed/narrRk1/64/84?grayscale') center/cover",
    name: "雾港夜话",
    sub: "★4.7 · 1,284 游玩",
  },
  {
    no: "02",
    rank: 2,
    coverBg:
      "linear-gradient(135deg,rgba(26,42,42,0.5),rgba(13,24,24,0.7)),url('https://picsum.photos/seed/narrRk2/64/84?grayscale') center/cover",
    name: "雨夜独行",
    sub: "★4.6 · 982 游玩",
  },
  {
    no: "03",
    rank: 3,
    coverBg:
      "linear-gradient(135deg,rgba(42,26,42,0.5),rgba(26,13,24,0.7)),url('https://picsum.photos/seed/narrRk3/64/84?grayscale') center/cover",
    name: "长安十二时辰谜",
    sub: "★4.4 · 642 游玩",
  },
  {
    no: "04",
    rank: 4,
    coverBg:
      "linear-gradient(135deg,rgba(26,26,42,0.5),rgba(13,13,24,0.7)),url('https://picsum.photos/seed/narrRk4/64/84?grayscale') center/cover",
    name: "星轨彼端",
    sub: "★4.5 · 588 游玩",
  },
  {
    no: "05",
    rank: 5,
    coverBg:
      "linear-gradient(135deg,rgba(42,42,26,0.5),rgba(24,24,16,0.7)),url('https://picsum.photos/seed/narrRk5/64/84?grayscale') center/cover",
    name: "青瓷记",
    sub: "★4.3 · 467 游玩",
  },
];

// ===================== 服务实现 =====================

/**
 * 创作社区侧栏聚合服务
 *
 * 所有方法均为 async，便于后续替换为真实聚合查询。
 */
export class CommunityService {
  /**
   * 热门话题列表。
   */
  async getTopics(): Promise<CommunityTopic[]> {
    return Promise.resolve(MOCK_TOPICS);
  }

  /**
   * 推荐作者列表。
   */
  async getRecommendedAuthors(): Promise<RecommendedAuthor[]> {
    return Promise.resolve(MOCK_AUTHORS);
  }

  /**
   * 热门剧本榜。
   */
  async getHotScripts(): Promise<RankScript[]> {
    return Promise.resolve(MOCK_RANK);
  }

  /**
   * 社区脉搏统计。
   */
  async getPulseStats(): Promise<PulseStat[]> {
    return Promise.resolve(MOCK_PULSE);
  }
}

/** 社区服务单例（开发期 Mock 使用） */
export const communityService = new CommunityService();
