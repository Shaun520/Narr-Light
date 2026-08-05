/**
 * 人物关系图谱页（T177 · 视图7）
 *
 * 路由：/dashboard/editor/[scriptId]/relations
 *
 * 严格参照原型 workbench2.html #view-relations 结构：
 *   1. .page-head      页头（标题 + 印章 + 重置布局 / 导出图谱）
 *   2. .rel-toolbar     工具栏（两行）
 *      - .rel-tab-row   VIEW 模式（全景/明线/暗线/阵营/亲密度）+ LAYOUT 布局（力导向/环形/层级）
 *      - .rel-filter-row FILTER 筛选（6 chips）+ 明暗开关（3 .tgl）
 *   3. .relation-layout 1fr 320px 双栏
 *      - 左：RelationGraph G6 关系图
 *      - 右：RelationDetailPanel 节点详情
 *   4. RelationEditor   关系编辑 Modal（双击连线触发）
 *
 * 客户端组件：管理 view / layout / filter / 显隐 / 选中节点 / 编辑器等状态。
 */
'use client';

import { use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RotateCcw, Download, Eye, EyeOff, Maximize, Menu, X } from 'lucide-react';
import RelationGraph, {
  type RelationLayout,
  type RelationGraphRef,
} from '@/components/visualization/relation-graph';
import RelationDetailPanel from '@/components/visualization/relation-detail-panel';
import RelationEditor from '@/components/visualization/relation-editor';
import {
  type CharacterCamp,
  type RelationEdge,
  type RelationGraphData,
  type RelationNode,
} from '@/lib/services/relation-extractor';
import {
  exportRelationGraphPng,
  exportRelationGraphPdf,
  type ExportResolution,
} from '@/lib/export/relation-graph-export';
import './relations.css';

/** VIEW 模式 tab 定义 */
interface ViewTab {
  view: 'all' | 'light' | 'dark' | 'camp' | 'affinity';
  label: string;
}
const VIEW_TABS: ViewTab[] = [
  { view: 'all', label: '全景' },
  { view: 'light', label: '明线' },
  { view: 'dark', label: '暗线' },
  { view: 'camp', label: '阵营' },
  { view: 'affinity', label: '亲密度' },
];

/** LAYOUT 布局 tab 定义 */
interface LayoutTab {
  layout: RelationLayout;
  label: string;
  icon: ReactNode;
}
const LAYOUT_TABS: LayoutTab[] = [
  {
    layout: 'force',
    label: '力导向',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8 6h8M6 8v8M18 8v8M8 18h8M9 9l6 6M15 9l-6 6" />
      </svg>
    ),
  },
  {
    layout: 'radial',
    label: '环形',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="4" r="1.5" />
        <circle cx="20" cy="12" r="1.5" />
        <circle cx="12" cy="20" r="1.5" />
        <circle cx="4" cy="12" r="1.5" />
        <path d="M12 7v2.5M14.5 12h2.5M12 14.5v2.5M7 12h2.5" />
      </svg>
    ),
  },
  {
    layout: 'tree',
    label: '层级',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <rect x="3" y="15" width="6" height="4" rx="1" />
        <rect x="15" y="15" width="6" height="4" rx="1" />
        <path d="M12 7v3M6 15v-2h12v2" />
      </svg>
    ),
  },
];

/** FILTER chip 定义 */
interface FilterChip {
  filter: 'all' | CharacterCamp;
  label: string;
}
const FILTER_CHIPS: FilterChip[] = [
  { filter: 'all', label: '全部' },
  { filter: 'shen', label: '沈家' },
  { filter: 'outsider', label: '外人' },
  { filter: 'deceased', label: '死者相关' },
  { filter: 'murderer', label: '凶手相关' },
  { filter: 'healer', label: '医者相关' },
];

/** 明暗开关定义 */
const LINE_TOGGLES = [
  { key: 'light' as const, label: '明线' },
  { key: 'dark' as const, label: '暗线' },
  { key: 'label' as const, label: '标签' },
];

interface PageProps {
  params: Promise<{ scriptId: string }>;
}

/**
 * 人物关系图谱页
 */
export default function RelationsPage({ params }: PageProps) {
  const { scriptId } = use(params);

  // ===== 状态 =====
  const [activeView, setActiveView] = useState<ViewTab['view']>('all');
  const [activeLayout, setActiveLayout] = useState<RelationLayout>('radial');
  const [activeFilter, setActiveFilter] = useState<FilterChip['filter']>('all');
  const [showLight, setShowLight] = useState(true);
  const [showDark, setShowDark] = useState(true);
  const [showLabel, setShowLabel] = useState(true);
  const [playerView, setPlayerView] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('edit');
  const [editorEdge, setEditorEdge] = useState<RelationEdge | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<RelationGraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 关系图容器引用：用于导出；图实例引用：用于重置/聚焦
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<RelationGraphRef>(null);
  const hintTimerRef = useRef<number | null>(null);

  const loadRelations = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/editor/${scriptId}/relations`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        graphData?: RelationGraphData;
        error?: string;
      };
      if (!response.ok || !payload.graphData) {
        throw new Error(payload.error || '读取人物关系失败');
      }
      setGraphData(payload.graphData);
      setSelectedNodeId((prev) => {
        if (prev && payload.graphData?.nodes.some((node) => node.id === prev)) return prev;
        return payload.graphData?.nodes[0]?.id ?? null;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '读取人物关系失败');
      setGraphData({ nodes: [], edges: [] });
      setSelectedNodeId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRelations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  // 初始操作提示
  useEffect(() => {
    const timer = window.setTimeout(() => {
      showHint('点击人物节点查看详情 · 拖拽调整位置 · 滚轮缩放');
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  // 玩家视角下强制隐藏暗线
  const effectiveShowDark = showDark && !playerView;

  // ===== 派生：根据 VIEW / FILTER 计算可见节点 =====
  const visibleData = useMemo(() => {
    // 1. 按 FILTER chip 筛选节点
    let nodes = graphData.nodes;
    if (activeFilter !== 'all') {
      // 死者/凶手/医者相关 = 包含该阵营的节点 + 与之有关系的节点
      if (activeFilter === 'deceased' || activeFilter === 'murderer' || activeFilter === 'healer') {
        const focusNodes = nodes.filter((n) => n.camp === activeFilter);
        const focusIds = new Set(focusNodes.map((n) => n.id));
        // 与 focus 节点有关系的节点也保留
        const relatedIds = new Set<string>();
        graphData.edges.forEach((e) => {
          if (focusIds.has(e.source)) relatedIds.add(e.target);
          if (focusIds.has(e.target)) relatedIds.add(e.source);
        });
        nodes = nodes.filter(
          (n) => focusIds.has(n.id) || relatedIds.has(n.id),
        );
      } else {
        // shen / outsider：直接按阵营过滤
        nodes = nodes.filter((n) => n.camp === activeFilter);
      }
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    // 2. 按 VIEW 模式筛选边
    let edges = graphData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    if (activeView === 'light' || playerView) {
      edges = edges.filter((e) => e.isVisible);
    } else if (activeView === 'dark') {
      edges = edges.filter((e) => e.isHiddenRelation);
    }
    // camp / affinity / all：保留全部边

    return { nodes, edges };
  }, [graphData, activeFilter, activeView, playerView]);

  // ===== 派生：选中节点对象 =====
  const selectedNode = useMemo<RelationNode | null>(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [graphData.nodes, selectedNodeId]);

  // ===== 派生：VIEW tab 计数 =====
  const viewCounts = useMemo(() => {
    const all = graphData.nodes.length;
    const light = graphData.edges.filter((e) => e.isVisible).length;
    const dark = graphData.edges.filter((e) => e.isHiddenRelation).length;
    const camps = new Set(graphData.nodes.map((n) => n.camp)).size;
    return { all, light, dark, camp: camps, affinity: 0 };
  }, [graphData]);

  // ===== 派生：FILTER chip 计数 =====
  const filterCounts = useMemo<Record<string, number>>(() => {
    const nodes = graphData.nodes;
    const countFor = (camp: CharacterCamp | 'all') => {
      if (camp === 'all') return nodes.length;
      if (camp === 'deceased' || camp === 'murderer' || camp === 'healer') {
        const focus = nodes.filter((n) => n.camp === camp).map((n) => n.id);
        const focusSet = new Set(focus);
        const related = new Set<string>();
        graphData.edges.forEach((e) => {
          if (focusSet.has(e.source)) related.add(e.target);
          if (focusSet.has(e.target)) related.add(e.source);
        });
        return focus.length + related.size;
      }
      return nodes.filter((n) => n.camp === camp).length;
    };
    return {
      all: countFor('all'),
      shen: countFor('shen'),
      outsider: countFor('outsider'),
      deceased: countFor('deceased'),
      murderer: countFor('murderer'),
      healer: countFor('healer'),
      other: 0,
    };
  }, [graphData]);

  // ===== 操作提示 =====
  const showHint = (text: string) => {
    setHint(text);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      setHint(null);
    }, 2200);
  };

  // ===== 事件：节点选中 =====
  const handleNodeSelect = (node: RelationNode) => {
    setSelectedNodeId(node.id);
    // 移动端自动打开侧栏
    if (window.innerWidth <= 768) {
      setSidebarOpen(true);
    }
  };

  // ===== 事件：边双击编辑 =====
  const handleEdgeEdit = (edge: RelationEdge) => {
    setEditorEdge(edge);
    setEditorMode('edit');
    setEditorOpen(true);
  };

  // ===== 事件：编辑器提交 =====
  const handleEditorSubmit = async (edge: RelationEdge) => {
    try {
      const response = await fetch(`/api/editor/${scriptId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edge }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '保存人物关系失败');
      setEditorOpen(false);
      setEditorEdge(null);
      await loadRelations();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '保存人物关系失败');
    }
  };

  // ===== 事件：编辑器删除 =====
  const handleEditorDelete = async (edgeId: string) => {
    try {
      const response = await fetch(`/api/editor/${scriptId}/relations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationId: edgeId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '删除人物关系失败');
      setEditorOpen(false);
      setEditorEdge(null);
      await loadRelations();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '删除人物关系失败');
    }
  };

  // ===== 事件：AI 快捷指令 =====
  const handleQuickPrompt = (prompt: string) => {
    // TODO: 接入 AI 关系调整服务
    showHint('已收到调整建议：' + prompt);
    console.log('[RelationsPage] AI quick prompt:', prompt);
  };

  // ===== 事件：重置布局 =====
  const handleResetLayout = () => {
    // 切换 layout 触发一次重新布局：先切到 force 再切回原 layout
    const target = activeLayout;
    setActiveLayout('force');
    setTimeout(() => setActiveLayout(target), 50);
    showHint('已重置布局');
  };

  // ===== 事件：重置视图（缩放/平移） =====
  const handleResetZoom = () => {
    graphRef.current?.resetZoom();
    showHint('已重置视图');
  };

  // ===== 事件：玩家视角切换 =====
  const handleTogglePlayerView = () => {
    const next = !playerView;
    setPlayerView(next);
    showHint(next ? '已切换为玩家视角，暗线关系已隐藏' : '已恢复完整视角');
  };

  // ===== 事件：聚焦节点 =====
  const handleFocusNode = (nodeId: string) => {
    graphRef.current?.focusNode(nodeId);
    showHint('已聚焦到选中人物');
  };

  // ===== 事件：跳转剧本（当前仅提示） =====
  const handleJumpToScript = (nodeId: string) => {
    showHint('正在跳转至人物剧本原文位置…');
    console.log('[RelationsPage] jump to script:', nodeId);
  };

  // ===== 事件：背景点击取消选中 =====
  const handleBackgroundClick = () => {
    setSelectedNodeId(null);
    setSidebarOpen(false);
  };

  // ===== 事件：导出图谱 =====
  const [exporting, setExporting] = useState(false);
  const handleExport = async (format: 'png' | 'pdf') => {
    if (!graphContainerRef.current || exporting) return;
    setExporting(true);
    try {
      const opts = {
        resolution: '2K' as ExportResolution,
        filename: `relation-graph-${Date.now()}`,
        title: '人物关系图谱',
        subtitle: '明暗双线可视化',
      };
      if (format === 'png') {
        await exportRelationGraphPng(graphContainerRef.current, opts);
      } else {
        await exportRelationGraphPdf(graphContainerRef.current, opts);
      }
    } catch (err) {
      console.error('[RelationsPage] export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // ===== 渲染 =====
  return (
    <div className="relations-page">
      {/* ===== 页头 ===== */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            人物关系图
            <span className="seal">{graphData.nodes.length} 人</span>
          </h1>
          <div className="page-desc">
            {loading
              ? '正在加载当前剧本人物关系…'
              : loadError
                ? loadError
                : '明暗双线可视化 · SVG 节点可拖拽 · 实时联动剧本段落'}
          </div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetLayout}
            title="重置布局"
          >
            <RotateCcw size={14} />
            重置布局
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetZoom}
            title="重置视图"
          >
            <Maximize size={14} />
            重置视图
          </button>
          <button
            type="button"
            className={`btn btn-sm ${playerView ? 'btn-primary' : 'btn-ghost'}`}
            onClick={handleTogglePlayerView}
            title="隐藏玩家不可见的暗线关系"
          >
            {playerView ? <EyeOff size={14} /> : <Eye size={14} />}
            玩家视角
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            title="导出 PDF"
          >
            <Download size={14} />
            PDF
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleExport('png')}
            disabled={exporting}
            title="导出 PNG"
          >
            <Download size={14} />
            导出图谱
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm rel-mobile-toggle"
            onClick={() => setSidebarOpen(true)}
            title="打开详情"
            aria-label="打开详情侧栏"
          >
            <Menu size={14} />
          </button>
        </div>
      </div>

      {/* ===== 工具栏 ===== */}
      <div className="rel-toolbar">
        {/* 第一行：VIEW + LAYOUT */}
        <div className="rel-tab-row">
          <span className="rv-label">VIEW</span>
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              className={`rel-vtab ${activeView === tab.view ? 'active' : ''}`}
              data-view={tab.view}
              onClick={() => setActiveView(tab.view)}
            >
              {tab.label}
              {tab.view !== 'affinity' ? (
                <span className="rv-num">{viewCounts[tab.view]}</span>
              ) : null}
            </button>
          ))}
          <span className="rv-div" />
          <span className="rv-label">LAYOUT</span>
          {LAYOUT_TABS.map((tab) => (
            <button
              key={tab.layout}
              type="button"
              className={`rel-vtab ${activeLayout === tab.layout ? 'active' : ''}`}
              data-layout={tab.layout}
              onClick={() => setActiveLayout(tab.layout)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 第二行：FILTER + 明暗开关 */}
        <div className="rel-filter-row">
          <span className="rv-label">FILTER</span>
          <div className="rel-chips">
            {FILTER_CHIPS.map((chip) => (
              <span
                key={chip.filter}
                className={`rel-chip ${activeFilter === chip.filter ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setActiveFilter(chip.filter)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveFilter(chip.filter);
                  }
                }}
              >
                {chip.label} <span className="rc-num">{filterCounts[chip.filter]}</span>
              </span>
            ))}
          </div>
          <div className="rel-line-toggle">
            {LINE_TOGGLES.map((tgl) => {
              const isDark = tgl.key === 'dark';
              const disabled = isDark && playerView;
              const checked =
                tgl.key === 'light'
                  ? showLight
                  : isDark
                    ? showDark
                    : showLabel;
              const setChecked = (v: boolean) => {
                if (disabled) return;
                if (tgl.key === 'light') setShowLight(v);
                else if (isDark) setShowDark(v);
                else setShowLabel(v);
              };
              return (
                <div key={tgl.key} className={`line-toggle ${disabled ? 'disabled' : ''}`}>
                  <span className="lt-label">{tgl.label}</span>
                  <label className="tgl">
                    <input
                      type="checkbox"
                      checked={disabled ? false : checked}
                      disabled={disabled}
                      onChange={(e) => setChecked(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 双栏布局 ===== */}
      <div className="relation-layout">
        {/* 左：关系图 */}
        <div
          className="card relation-graph-card"
          ref={graphContainerRef}
          style={{ padding: 0, overflow: 'hidden', minHeight: 540, position: 'relative' }}
        >
          <RelationGraph
            ref={graphRef}
            data={visibleData}
            layout={activeLayout}
            showLight={showLight}
            showDark={effectiveShowDark}
            showLabel={showLabel}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onEdgeEdit={handleEdgeEdit}
            onBackgroundClick={handleBackgroundClick}
          />

          {/* 图例 */}
          <div className="rel-graph-legend" aria-label="关系图例">
            <div className="rel-legend-title">关系图例</div>
            <div className="rel-legend-item">
              <span className="rel-legend-line light" />
              <span>明线 · 玩家可见</span>
            </div>
            <div className="rel-legend-item">
              <span className="rel-legend-line dark" />
              <span>暗线 · 真相复盘</span>
            </div>
          </div>

          {/* 操作提示 */}
          <div className={`rel-graph-hint ${hint ? 'show' : ''}`} aria-live="polite">
            {hint ?? '点击人物节点查看详情 · 拖拽调整位置 · 滚轮缩放'}
          </div>
        </div>

        {/* 右：详情面板 */}
        <aside className={`side-panel ${sidebarOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="rel-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭详情"
          >
            <X size={16} />
          </button>
          <RelationDetailPanel
            node={selectedNode}
            edges={graphData.edges}
            nodes={graphData.nodes}
            onRelationClick={(edge) => {
              setEditorEdge(edge);
              setEditorMode('edit');
              setEditorOpen(true);
            }}
            onQuickPrompt={handleQuickPrompt}
            onJumpToScript={handleJumpToScript}
            onFocusNode={handleFocusNode}
          />
        </aside>

        {/* 移动端侧栏遮罩 */}
        {sidebarOpen ? (
          <div
            className="rel-sidebar-backdrop"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
      </div>

      {/* ===== 关系编辑 Modal ===== */}
      <RelationEditor
        open={editorOpen}
        edge={editorEdge}
        mode={editorMode}
        nodes={graphData.nodes}
        onClose={() => {
          setEditorOpen(false);
          setEditorEdge(null);
        }}
        onSubmit={handleEditorSubmit}
        onDelete={handleEditorDelete}
      />
    </div>
  );
}
