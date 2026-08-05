/**
 * 时间线校验页（T146 · 视图4）
 *
 * 路由：/editor/[scriptId]/timeline
 *
 * 严格参照原型 docs/prototype/workbench2.html #view-timeline 结构：
 *   1. .page-head         页头（标题 + 印章 + 导出报告 / 重新校验）
 *   2. .timeline-toolbar  单行：角色筛选 .filter-chip · 「全部幕次」+「仅看冲突」
 *   3. .timeline-wrap     水平泳道时间轴（TimelineChart 组件）
 *   4. .conflict-list     冲突列表（含"前往修正"按钮）
 *
 * 数据加载：
 *   - 页面 mount 时 POST /api/validate { scriptId } 加载真实事件与冲突
 *   - 并行 fetch /api/editor/{scriptId} 获取剧本标题
 *   - 422 响应视为"内容不足"空状态，非 2xx 视为错误
 *
 * 手动修正（T150）：
 *   - 点击冲突项"前往修正"按钮 → 跳转到编辑器对应位置
 *     URL: /editor/[scriptId]?act=N&char=charId&event=eventId
 *   - 点击"重新校验"按钮 → 重新调用 /api/validate 拉取最新数据
 *
 * 客户端组件：管理 selectedChars / onlyConflicts 状态。
 */
'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Download, Sparkles } from 'lucide-react';
import {
  TimelineChart,
  type TimelineLane,
} from '@/components/visualization/timeline-chart';
import { TimelineConflictList } from '@/components/visualization/timeline-conflict-list';
import {
  ConflictDetector,
  type ConflictItem,
} from '@/lib/validation/timeline/conflict-detector';
import type { TimelineEvent } from '@/lib/validation/timeline/extractor';
import { computeTimeWindow } from '@/lib/validation/timeline/time-window';
import { exportTimelineReportPdf } from '@/lib/export/timeline-report-pdf';
import './timeline.css';

interface PageProps {
  params: Promise<{ scriptId: string }>;
}

/* =========================================================
 * 角色元信息（由 events 派生，不再硬编码）
 * ========================================================= */
interface CharacterMeta {
  id: string;
  name: string;
  color: string;
}

/** /api/validate 成功响应体 */
interface ValidateResponse {
  scriptId: string;
  events: TimelineEvent[];
  conflicts: ConflictItem[];
  stats: {
    totalEvents: number;
    totalConflicts: number;
    severeCount: number;
    warningCount: number;
    hintCount: number;
    narrativeTrickCount: number;
  };
  reportId: string | null;
  createdAt: string;
}

/** /api/validate 错误响应体（422 与 5xx 共用） */
interface ValidateErrorResponse {
  error: string;
  scriptId: string;
  events?: TimelineEvent[];
  conflicts?: ConflictItem[];
}

/** /api/editor/[scriptId] 响应体（仅关心 scriptTitle 字段） */
interface EditorBundleWithTitle {
  scriptTitle?: string;
  dataMap?: Record<string, unknown>;
  groups?: unknown[];
  labels?: Record<string, string>;
  defaultNodeId?: string;
}

/** loadTimeline 返回值：成功时携带最新 events 与 conflicts */
interface LoadTimelineResult {
  events: TimelineEvent[];
  conflicts: ConflictItem[];
}

/** Toast 提示状态（对齐编辑器页 save-toast 模式） */
interface ToastState {
  visible: boolean;
  message: string;
  icon: string;
}

/**
 * 从 events 派生角色列表（按 characterId 聚合去重）。
 * 保留 events 中的原始 characterColor（已由 TimelineExtractor 按 sort_order 取模生成）。
 */
function deriveCharacters(events: TimelineEvent[]): CharacterMeta[] {
  const map = new Map<string, CharacterMeta>();
  for (const e of events) {
    if (map.has(e.characterId)) continue;
    map.set(e.characterId, {
      id: e.characterId,
      name: e.characterName,
      color: e.characterColor,
    });
  }
  return Array.from(map.values());
}

/**
 * 时间线校验页
 */
export default function TimelinePage({ params }: PageProps) {
  const { scriptId } = use(params);
  const router = useRouter();

  // 状态：选中角色（多选）/ 仅看冲突
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [onlyConflicts, setOnlyConflicts] = useState(false);

  // 事件数据 / 角色列表 / 剧本标题（由真实接口加载）
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [characters, setCharacters] = useState<CharacterMeta[]>([]);
  const [scriptTitle, setScriptTitle] = useState('');

  // 加载状态：loading=首次加载 / loadError=加载失败 / emptyHint=422 友好提示
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);

  // 重新校验中（按钮 loading）
  const [validating, setValidating] = useState(false);
  // 时间线结构重新生成中（422 空态时触发）
  const [regenerating, setRegenerating] = useState(false);

  // Toast 反馈
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    icon: '✓',
  });

  // ref 同步存储最新加载错误信息，供 handleRevalidate 即时读取
  const loadErrorRef = useRef<string | null>(null);

  // Toast 自动消失
  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [toast.visible, toast.message]);

  /** 显示 Toast */
  const showToast = (message: string, icon = '✓') => {
    setToast({ visible: true, message, icon });
  };

  // 冲突检测
  const detector = useMemo(() => new ConflictDetector(), []);
  const conflicts: ConflictItem[] = useMemo(
    () => detector.detect(events),
    [detector, events],
  );
  const conflictEventIds = useMemo(
    () => new Set(conflicts.flatMap((c) => c.eventIds)),
    [conflicts],
  );

  // 自适应时间窗口（从全量 events 计算，客户端安全）
  const timeWindow = useMemo(() => computeTimeWindow(events), [events]);

  // 按角色分组成轨道（仅过滤选中角色）
  const lanes: TimelineLane[] = useMemo(() => {
    return characters
      .filter((c) => selectedChars.has(c.id))
      .map((c) => ({
        characterId: c.id,
        characterName: c.name,
        characterColor: c.color,
        events: events.filter((e) => e.characterId === c.id),
      }));
  }, [events, characters, selectedChars]);

  /**
   * 加载时间线数据：POST /api/validate 携带 { scriptId }
   * 并行 fetch /api/editor/${scriptId} 获取剧本标题。
   *
   * - 422 响应：设置 emptyHint 友好提示，清空 events，不视为错误
   * - 非 2xx 响应：解析 error 字段，设置 loadError
   * - 成功：setEvents + 派生 characters，清空 loadError/emptyHint
   *
   * 返回最新的 { events, conflicts }，供调用方（如重新校验）即时使用；
   * 失败时返回 null（loadError 同步写入 loadErrorRef 供即时读取）。
   */
  const loadTimeline = async (id: string): Promise<LoadTimelineResult | null> => {
    loadErrorRef.current = null;

    // 并行：校验接口 + 编辑器接口（取 scriptTitle）
    const [validateRes, editorRes] = await Promise.all([
      fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: id }),
      }),
      fetch(`/api/editor/${id}`, { cache: 'no-store' }).catch(() => null),
    ]);

    // 解析剧本标题（容错：失败不影响时间线展示）
    if (editorRes && editorRes.ok) {
      try {
        const editorData = (await editorRes.json()) as EditorBundleWithTitle;
        if (editorData.scriptTitle) {
          setScriptTitle(editorData.scriptTitle);
        }
      } catch {
        // 忽略 JSON 解析失败
      }
    }

    // 解析校验响应
    let validateData: ValidateResponse | ValidateErrorResponse;
    try {
      validateData = (await validateRes.json()) as ValidateResponse | ValidateErrorResponse;
    } catch {
      const msg = '校验响应解析失败';
      setLoadError(msg);
      loadErrorRef.current = msg;
      setEvents([]);
      setCharacters([]);
      setLoading(false);
      return null;
    }

    // 422：内容不足，友好提示（不视为错误）
    if (validateRes.status === 422) {
      const errBody = validateData as ValidateErrorResponse;
      setEmptyHint(errBody.error || '未提取到时间线事件，请先在剧本中标注时间点');
      setEvents([]);
      setCharacters([]);
      setLoadError(null);
      setLoading(false);
      return { events: [], conflicts: [] };
    }

    // 非 2xx：错误
    if (!validateRes.ok) {
      const errBody = validateData as ValidateErrorResponse;
      const msg = errBody.error || `校验失败（${validateRes.status}）`;
      setLoadError(msg);
      loadErrorRef.current = msg;
      setEvents([]);
      setCharacters([]);
      setLoading(false);
      return null;
    }

    // 成功
    const okBody = validateData as ValidateResponse;
    const newEvents = okBody.events ?? [];
    const newConflicts = okBody.conflicts ?? detector.detect(newEvents);
    setEvents(newEvents);
    setCharacters(deriveCharacters(newEvents));
    setLoadError(null);
    setEmptyHint(null);
    setLoading(false);
    return { events: newEvents, conflicts: newConflicts };
  };

  // 页面 mount 时加载真实数据
  useEffect(() => {
    loadTimeline(scriptId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  // 角色列表派生后默认全选
  useEffect(() => {
    setSelectedChars(new Set(characters.map((c) => c.id)));
  }, [characters]);

  /* ===== 事件处理 ===== */

  /** 切换角色筛选 */
  const toggleChar = (charId: string) => {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        next.add(charId);
      }
      return next;
    });
  };

  /** 切换仅看冲突 */
  const toggleOnlyConflicts = () => {
    setOnlyConflicts((prev) => !prev);
  };

  /** 跳转到编辑器对应位置（T150 手动修正） */
  const handleJumpToFix = (conflict: ConflictItem) => {
    const act = conflict.actOrders[0] ?? 1;
    const charId = conflict.characterIds[0] ?? '';
    const eventId = conflict.eventIds[0] ?? '';
    const params = new URLSearchParams({
      act: String(act),
      char: charId,
      event: eventId,
      from: 'timeline',
    });
    router.push(`/editor/${scriptId}?${params.toString()}`);
  };

  /** 重试加载（点击错误态重试按钮） */
  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    loadErrorRef.current = null;
    loadTimeline(scriptId);
  };

  /**
   * 重新校验：调用 loadTimeline 复用同一加载逻辑，
   * 成功后用返回值即时计算冲突数并显示 Toast。
   */
  const handleRevalidate = async () => {
    if (validating) return;
    setValidating(true);
    showToast('正在重新校验时间线…', '◌');

    try {
      const result = await loadTimeline(scriptId);
      if (result === null) {
        showToast(`校验失败：${loadErrorRef.current ?? '未知错误'}`, '✗');
      } else {
        const severeCount = result.conflicts.filter((c) => c.severity === 'severe').length;
        showToast(
          `校验完成 · 共 ${result.conflicts.length} 条冲突（严重 ${severeCount}）`,
          severeCount > 0 ? '!' : '✓',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showToast(`校验失败：${msg}`, '✗');
    } finally {
      setValidating(false);
    }
  };

  /**
   * 重新生成时间线结构：当 /api/validate 返回 422（timeline_events 表为空且
   * acts/scenes 文本无 HH:MM 时间点）时，调用 /api/timeline/regenerate 触发
   * timeline-structure 阶段，把 truth_reviews.timeline_full 的自然语言时间描述
   * 结构化为 timeline_events 行；成功后自动重新校验。
   */
  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    showToast('正在生成时间线结构…', '◌');

    try {
      const res = await fetch('/api/timeline/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        eventCount?: number;
        mode?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        const msg = data.error ?? `生成失败（${res.status}）`;
        showToast(`生成失败：${msg}`, '✗');
        setRegenerating(false);
        return;
      }

      showToast(
        `时间线结构生成完成 · ${data.eventCount} 条事件（${data.mode === 'real' ? 'AI' : '占位'}）`,
        '✓',
      );

      // 生成成功后清空 emptyHint 并重新校验
      setEmptyHint(null);
      setLoading(true);
      setRegenerating(false);
      await loadTimeline(scriptId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showToast(`生成失败：${msg}`, '✗');
      setRegenerating(false);
    }
  };

  /**
   * 导出报告：通过隐藏 iframe 打印方案生成 PDF（浏览器打印对话框另存为 PDF）。
   * 内容包含时间线图、冲突列表、角色时间表。
   */
  const handleExport = () => {
    try {
      exportTimelineReportPdf({
        scriptId,
        scriptTitle: scriptTitle || '未命名剧本',
        events,
        conflicts,
        characters: characters.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        })),
        validatedAt: Date.now(),
      });
      showToast('已唤起打印对话框，选择"另存为 PDF"即可下载', '⤓');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showToast(`导出失败：${msg}`, '✗');
    }
  };

  return (
    <div className="timeline-page">
      {/* ===== 页头 ===== */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            时间线校验 <span className="seal">P1</span>
          </h1>
          <div className="page-desc">
            {'// 全角色时间轴可视化 · 自动标注时序冲突 · 支持手动修正'}
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={handleExport}>
            <Download size={15} />
            导出报告
          </button>
          <button
            type="button"
            className={`btn btn-primary ${validating ? 'is-loading' : ''}`}
            onClick={handleRevalidate}
            disabled={validating || loading || regenerating}
          >
            <RefreshCw size={15} />
            {validating ? '校验中…' : '重新校验'}
          </button>
        </div>
      </div>

      {/* ===== 工具栏（单行 · 对齐原型） ===== */}
      <div className="timeline-toolbar">
        <span className="tb-label">按角色筛选：</span>
        {characters.map((c) => (
          <div
            key={c.id}
            className={`filter-chip ${selectedChars.has(c.id) ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => toggleChar(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleChar(c.id);
              }
            }}
          >
            <span className="swatch" style={{ background: c.color }} aria-hidden />
            {c.name}
          </div>
        ))}

        {/* 右侧：全部幕次 + 仅看冲突 */}
        <div className="tb-right">
          <div className="filter-chip active" aria-label="全部幕次">全部幕次</div>
          <div
            className={`filter-chip chip-conflict ${onlyConflicts ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={onlyConflicts}
            onClick={toggleOnlyConflicts}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleOnlyConflicts();
              }
            }}
          >
            仅看冲突
          </div>
        </div>
      </div>

      {/* ===== 主体：根据加载状态条件渲染 ===== */}
      {loading ? (
        <div className="state-block">正在加载时间线…</div>
      ) : loadError ? (
        <div className="state-block is-err">
          <p>加载失败：{loadError}</p>
          <div className="state-actions">
            <button type="button" className="btn btn-ghost" onClick={handleRetry}>
              <RefreshCw size={15} />
              重试
            </button>
          </div>
        </div>
      ) : emptyHint ? (
        <div className="state-block">
          <p>◇ {emptyHint}</p>
          <div className="state-actions">
            <button
              type="button"
              className={`btn btn-primary ${regenerating ? 'is-loading' : ''}`}
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <Sparkles size={15} />
              {regenerating ? '生成中…' : '生成时间线结构'}
            </button>
          </div>
          <div className="state-hint">
            将从「真相复盘」的 timeline_full 中识别时间点并按角色拆分结构化事件
          </div>
        </div>
      ) : (
        <>
          {/* ===== 时间轴 ===== */}
          <TimelineChart
            lanes={lanes}
            conflictEventIds={conflictEventIds}
            onlyConflicts={onlyConflicts}
            timeWindow={timeWindow}
          />

          {/* ===== 冲突列表 ===== */}
          <TimelineConflictList conflicts={conflicts} onJumpToFix={handleJumpToFix} />
        </>
      )}

      {/* ===== Toast ===== */}
      {toast.visible && (
        <div
          className={`tl-toast show ${toast.icon === '✗' ? 't-err' : toast.icon === '!' ? 't-warn' : ''}`}
          role="status"
        >
          <span className="toast-icon">{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
