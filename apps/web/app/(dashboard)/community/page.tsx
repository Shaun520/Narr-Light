"use client";

/**
 * 创作社区页（视图9）
 *
 * 对齐原型 #view-community，瀑布流 + 侧栏布局。
 * 客户端组件，管理视角（creator/player）、分类、筛选 chips 状态；
 * 动态流数据由服务端 actions 提供（真实 community_posts，仅展示已上架内容），
 * 侧栏话题/作者榜/统计仍为开发期 Mock。
 *
 * 结构：
 * 1. .page-head —— 标题 + .perspective-switch + 双套按钮（.for-creator/.for-player）
 * 2. .xhs-search —— 搜索框 + 热门标签
 * 3. .xhs-cats / .xhs-chips —— 分类 tab + 联动筛选 chips
 * 4. .xhs-pulse —— 社区脉搏（4 项统计）
 * 5. .xhs-layout —— 瀑布流 .xhs-feed + 侧栏 .xhs-sidebar
 * 6. .xhs-fab —— 右下悬浮发布按钮
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { App as AntApp } from "antd";
import { Plus, Play, MessageCircle, Search } from "lucide-react";
import { communityService } from "@/lib/services/community-service";
import type {
  CategoryKey,
  CommunityPost,
  CommunityTopic,
  Perspective,
  PulseStat,
  RankScript,
  RecommendedAuthor,
} from "@/lib/services/community-service";
import {
  createCommunityPostAction,
  getCommunityFeedAction,
  type CreateCommunityPostInput,
} from "./actions";
import PerspectiveSwitch from "@/components/community/perspective-switch";
import CategoryTabs from "@/components/community/category-tabs";
import PulseStats from "@/components/community/pulse-stats";
import FeedCard from "@/components/community/feed-card";
import SidebarWidgets from "@/components/community/sidebar-widgets";
import PublishModal, {
  type PublishType,
} from "@/components/community/publish-modal";
import "./community.css";

/** 搜索框热门标签 */
const HOT_TAGS = ["#雾港夜话", "#长安十二时辰谜"];

/** 题材 value → 中文标签（与 publish-modal 的 GENRE_OPTIONS 对齐） */
const GENRE_LABELS: Record<string, string> = {
  hardcore: "硬核",
  emotion: "情感",
  horror: "惊悚",
  funny: "欢乐",
  mechanism: "机制",
};

/** 把发布弹窗表单数据映射为创建帖子入参（4 种发布类型） */
function buildPublishInput(
  type: PublishType,
  data: Record<string, string>,
): CreateCommunityPostInput {
  switch (type) {
    case "submit":
      return {
        postType: "talk",
        title: data.title ?? "",
        content: data.content ?? "",
        tags: ["投稿"],
      };
    case "publish": {
      const tags = [
        data.genre ? GENRE_LABELS[data.genre] ?? data.genre : "",
        data.playerCount ? `${data.playerCount}人` : "",
        data.duration ? `${data.duration}小时` : "",
      ].filter(Boolean);
      return {
        postType: "rec",
        title: data.scriptName ?? "",
        content: data.intro ?? "",
        tags,
      };
    }
    case "carpool": {
      const playerCount = Math.max(0, Number(data.playerCount) || 0);
      return {
        postType: "carpool",
        title: [data.time, data.location, data.scriptName].filter(Boolean).join(" · "),
        content: data.remark ?? "",
        seatTotal: playerCount,
      };
    }
    case "request":
      return {
        postType: "ask",
        title: data.scriptName ?? "",
        content: data.description ?? "",
        tags: data.expectedCount ? [`${data.expectedCount}人`] : [],
      };
  }
}

export default function CommunityPage() {
  // ---- antd message（用于发布成功 Toast 反馈）----
  const { message } = AntApp.useApp();

  // ---- 交互状态 ----
  const [perspective, setPerspective] = useState<Perspective>("creator");
  const [category, setCategory] = useState<CategoryKey>("recommend");
  const [chip, setChip] = useState("全部");

  // ---- 数据 ----
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [authors, setAuthors] = useState<RecommendedAuthor[]>([]);
  const [rank, setRank] = useState<RankScript[]>([]);
  const [pulse, setPulse] = useState<PulseStat[]>([]);

  // ---- FAB 脉冲动画 ----
  const [fabPulse, setFabPulse] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- 发布弹窗状态 ----
  const [publishModal, setPublishModal] = useState<{
    open: boolean;
    type: PublishType;
  }>({ open: false, type: "submit" });

  /** 防止快速切分类时旧请求覆盖新结果 */
  const feedRequestIdRef = useRef(0);

  /** 打开发布弹窗 */
  const openPublish = (type: PublishType) => {
    setPublishModal({ open: true, type });
  };

  /** 拉取真实动态流（仅已上架内容），支持分类过滤 */
  const loadFeed = useCallback(async (cat: CategoryKey) => {
    const requestId = ++feedRequestIdRef.current;
    setFeedLoading(true);
    setFeedError("");
    const result = await getCommunityFeedAction({ category: cat });
    if (requestId !== feedRequestIdRef.current) return;
    setPosts(result.posts);
    setFeedError(result.error ?? "");
    setFeedLoading(false);
  }, []);

  /** 首次挂载：拉取动态流 + 侧栏聚合数据（侧栏仍为 Mock） */
  useEffect(() => {
    void loadFeed("recommend");
    void (async () => {
      const [t, a, r, pl] = await Promise.all([
        communityService.getTopics(),
        communityService.getRecommendedAuthors(),
        communityService.getHotScripts(),
        communityService.getPulseStats(),
      ]);
      setTopics(t);
      setAuthors(a);
      setRank(r);
      setPulse(pl);
    })();
  }, [loadFeed]);

  /** 切换分类：重置 chip 为 "全部" 并重新拉取动态流 */
  const handleCategoryChange = (cat: CategoryKey) => {
    setCategory(cat);
    setChip("全部");
    void loadFeed(cat);
  };

  /** FAB：脉冲动画 + 滚动聚焦搜索框 */
  const handleFab = () => {
    setFabPulse(true);
    window.setTimeout(() => setFabPulse(false), 360);
    const input = searchInputRef.current;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /** 发布提交：写入 community_posts 并进入待审，由 Admin 审核后展示 */
  const handlePublish = async (type: PublishType, data: Record<string, string>) => {
    const input = buildPublishInput(type, data);
    const result = await createCommunityPostAction(input);
    if (result.error) {
      message.error(result.error);
      return;
    }
    setPublishModal({ ...publishModal, open: false });
    message.success("已提交，审核通过后展示");
  };

  return (
    <section className="community-view" data-perspective={perspective}>
      {/* ===== 页头 ===== */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            创作社区 <span className="seal">BETA</span>
          </h1>
          <div className="page-desc">
            {"// 创作者发行 · 玩家拼车 · 攻略讨论 · 双向反馈闭环"}
          </div>
        </div>
        <div className="page-actions">
          <PerspectiveSwitch perspective={perspective} onChange={setPerspective} />
          {/* 创作者视角按钮 */}
          <button
            type="button"
            className="btn btn-ghost for-creator"
            onClick={() => openPublish("submit")}
          >
            <Plus />
            投稿作品
          </button>
          <button
            type="button"
            className="btn btn-primary for-creator"
            onClick={() => openPublish("publish")}
          >
            <Play />
            发布剧本
          </button>
          {/* 玩家视角按钮 */}
          <button
            type="button"
            className="btn btn-ghost for-player"
            onClick={() => openPublish("carpool")}
          >
            <Plus />
            发起拼车
          </button>
          <button
            type="button"
            className="btn btn-primary for-player"
            onClick={() => openPublish("request")}
          >
            <MessageCircle />
            求本组局
          </button>
        </div>
      </div>

      {/* ===== 搜索 ===== */}
      <div className="xhs-search">
        <Search />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="搜剧本 · 找作者 · 看攻略 · 蹭拼车…"
        />
        {HOT_TAGS.map((tag) => (
          <span className="xs-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      {/* ===== 分类 Tab + 筛选 chips ===== */}
      <CategoryTabs
        category={category}
        chip={chip}
        onCategoryChange={handleCategoryChange}
        onChipChange={setChip}
      />

      {/* ===== 社区脉搏 ===== */}
      <PulseStats stats={pulse} />

      {/* ===== 瀑布流 + 侧栏 ===== */}
      <div className="xhs-layout">
        <div className="xhs-feed">
          {feedLoading ? (
            <div className="xhs-feed-state">动态加载中…</div>
          ) : feedError ? (
            <div className="xhs-feed-state error">
              <span>{feedError}</span>
              <button type="button" onClick={() => void loadFeed(category)}>
                重试
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="xhs-feed-state">暂无内容</div>
          ) : (
            posts.map((post) => <FeedCard key={post.id} post={post} />)
          )}
        </div>

        <SidebarWidgets topics={topics} authors={authors} rank={rank} />
      </div>

      {/* ===== 悬浮发布按钮 ===== */}
      <button
        type="button"
        className={`xhs-fab${fabPulse ? " pulse" : ""}`}
        onClick={handleFab}
        title="发布内容"
        aria-label="发布内容"
      >
        <Plus />
      </button>

      {/* ===== 发布弹窗（4 种类型共用）===== */}
      <PublishModal
        open={publishModal.open}
        type={publishModal.type}
        onClose={() => setPublishModal({ ...publishModal, open: false })}
        onSubmit={(data) => void handlePublish(publishModal.type, data)}
      />
    </section>
  );
}
