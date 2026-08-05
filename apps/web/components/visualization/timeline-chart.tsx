/**
 * 时间线泳道组件（视图4 · #view-timeline）
 *
 * 严格参照原型 docs/prototype/workbench2.html #view-timeline 结构：
 *   - .timeline-wrap 外层纸张容器
 *   - .tl-axis 2 列网格（120px 角色名 + 1fr 时间轴）
 *   - .tl-time-header 时间刻度行（8 个等分列）
 *   - 每个角色：.tl-char + .tl-track 一对
 *   - .tl-event 绝对定位块（按时间窗 left%/width%）
 *   - .tl-event.conflict 冲突态：朱砂红脉冲边框
 *   - .tl-event::after 悬浮 tooltip（data-tip 属性）
 *
 * 时间窗默认从所有 events 自适应计算（computeTimeWindow）；
 * 时间刻度按时窗长度动态选择间隔（1h/2h/6h/12h），并对齐到整点。
 * 跨日用 24+h 表示，HH:MM 输出时取模 24 显示。
 */
'use client';

import { Fragment, useMemo } from 'react';
import type { TimelineEvent } from '@/lib/validation/timeline/extractor';
import { computeTimeWindow } from '@/lib/validation/timeline/time-window';

/** 时间线轨道行（角色 + 事件） */
export interface TimelineLane {
  characterId: string;
  characterName: string;
  characterColor: string;
  events: TimelineEvent[];
}

interface TimelineChartProps {
  /** 轨道列表（按角色顺序） */
  lanes: TimelineLane[];
  /** 冲突事件 ID 集合 */
  conflictEventIds: Set<string>;
  /** 仅显示冲突事件 */
  onlyConflicts?: boolean;
  /** 时间轴窗口（分钟）。可选，不传时从 events 自动计算 */
  timeWindow?: { start: number; end: number };
}

/** 分钟数 → HH:MM（跨日取模 24 显示） */
function minuteToLabel(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/**
 * 根据时间窗长度选择合适的时间刻度间隔。
 * ≤8h：每小时；≤16h：每 2h；≤48h：每 6h；>48h：每 12h。
 */
function pickInterval(durationMin: number): number {
  if (durationMin <= 8 * 60) return 60;
  if (durationMin <= 16 * 60) return 120;
  if (durationMin <= 48 * 60) return 360;
  return 720;
}

/** 单个事件 → 绝对定位的 left/width 百分比 */
function eventPosition(
  e: TimelineEvent,
  window: { start: number; end: number },
): { left: number; width: number } {
  const duration = window.end - window.start;
  if (duration <= 0) return { left: 0, width: 0 };
  const left = ((e.startMinutes - window.start) / duration) * 100;
  const width = ((e.endMinutes - e.startMinutes) / duration) * 100;
  // 最小宽度：保证文字可读（至少约 72px 在 760px 轨道内 ≈ 9.5%）
  return { left, width: Math.max(width, 9.5) };
}

/** 事件在轨道中的定位（含 sub-row） */
interface PlacedEvent {
  event: TimelineEvent;
  subRow: number;
  left: number;
  width: number;
}

/** 布局后的泳道（含每个事件的 sub-row 索引与轨道高度） */
interface LaidOutLane extends TimelineLane {
  placed: PlacedEvent[];
  trackHeight: number;
}

/** 每个 sub-row 的高度（事件块 + 上下留白） */
const SUB_ROW_HEIGHT = 56;

/** 轨道上下内边距 */
const TRACK_PADDING = 20;

/** 最小轨道高度（保持空轨道/无重叠事件时的视觉稳定） */
const MIN_TRACK_HEIGHT = 96;

/**
 * 贪心分配 sub-row：按开始时间排序，每个事件进入第一个
 * 「其末尾 ≤ 当前开始」的 sub-row，否则新增 sub-row。
 * 这样能保证时间上重叠的事件落在不同 sub-row，避免水平堆叠。
 */
function layoutLane(
  lane: TimelineLane,
  filterEvent: (e: TimelineEvent) => boolean,
  window: { start: number; end: number },
): LaidOutLane {
  const subRowEnds: number[] = [];
  const placed: PlacedEvent[] = [];

  const events = lane.events
    .filter(filterEvent)
    .slice()
    .sort((a, b) => a.startMinutes - b.startMinutes);

  for (const event of events) {
    let subRow = subRowEnds.findIndex((end) => end <= event.startMinutes);
    if (subRow === -1) {
      subRow = subRowEnds.length;
      subRowEnds.push(event.endMinutes);
    } else {
      subRowEnds[subRow] = event.endMinutes;
    }
    const { left, width } = eventPosition(event, window);
    placed.push({ event, subRow, left, width });
  }

  const trackHeight = Math.max(
    MIN_TRACK_HEIGHT,
    TRACK_PADDING * 2 + subRowEnds.length * SUB_ROW_HEIGHT,
  );

  return { ...lane, placed, trackHeight };
}

/**
 * 水平时间线泳道组件
 */
export function TimelineChart({
  lanes,
  conflictEventIds,
  onlyConflicts = false,
  timeWindow,
}: TimelineChartProps) {
  // 汇总所有事件
  const allEvents = useMemo(
    () => lanes.flatMap((lane) => lane.events),
    [lanes],
  );

  // 时间窗口
  const window = useMemo(() => {
    if (timeWindow) return timeWindow;
    return computeTimeWindow(allEvents);
  }, [timeWindow, allEvents]);

  // 时间刻度标签（按整点对齐）
  const timeLabels = useMemo(() => {
    const duration = window.end - window.start;
    if (duration <= 0) return [];
    const interval = pickInterval(duration);
    const labels: { minutes: number; position: number; text: string }[] = [];
    // 对齐到 interval 边界
    const startMin = Math.ceil(window.start / interval) * interval;
    for (let m = startMin; m <= window.end; m += interval) {
      const position = ((m - window.start) / duration) * 100;
      labels.push({ minutes: m, position, text: minuteToLabel(m) });
    }
    return labels;
  }, [window]);

  // 过滤 lane：仅看冲突时只保留含冲突事件的 lane
  const visibleLanes = useMemo(() => {
    if (!onlyConflicts) return lanes;
    return lanes.filter((lane) =>
      lane.events.some((e) => conflictEventIds.has(e.id)),
    );
  }, [lanes, onlyConflicts, conflictEventIds]);

  // 为每个 lane 计算 sub-row 排布与高度
  const laidOutLanes = useMemo(
    () =>
      visibleLanes.map((lane) =>
        layoutLane(
          lane,
          (e) => !onlyConflicts || conflictEventIds.has(e.id),
          window,
        ),
      ),
    [visibleLanes, onlyConflicts, conflictEventIds, window],
  );

  if (allEvents.length === 0) {
    return (
      <div className="timeline-wrap timeline-empty">
        <div className="timeline-empty-content">
          <span className="timeline-empty-icon">◇</span>
          <p>当前筛选条件下没有时间线事件</p>
          <span className="timeline-empty-hint">
            时间窗口：{minuteToLabel(window.start)} – {minuteToLabel(window.end)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-wrap">
      <div className="tl-axis">
        {/* 左上角空格 */}
        <div className="tl-corner" />

        {/* 时间刻度行 */}
        <div className="tl-time-header">
          {timeLabels.map((l) => (
            <span
              key={l.minutes}
              className="tl-time-label"
              style={{ left: `${l.position}%` }}
            >
              {l.text}
            </span>
          ))}
        </div>

        {/* 每个角色一行：左侧名字 + 右侧轨道（高度自适应 sub-row 数量） */}
        {laidOutLanes.map((lane) => (
          <Fragment key={lane.characterId}>
            <div className="tl-char">
              <span
                className="swatch"
                style={{ background: lane.characterColor }}
                aria-hidden
              />
              {lane.characterName}
            </div>
            <div
              className="tl-track"
              style={{ height: `${lane.trackHeight}px` }}
            >
              {lane.placed.map(({ event, subRow, left, width }) => {
                const isConflict = conflictEventIds.has(event.id);
                const tip = `${event.characterName} · ${event.eventName} · ${event.startTime}–${event.endTime}`;
                // 事件块垂直居中于自己的 sub-row
                const top =
                  TRACK_PADDING + subRow * SUB_ROW_HEIGHT + SUB_ROW_HEIGHT / 2;
                // 宽度 < 6% 时应用窄态样式（隐藏时间，只保留事件名）
                const isNarrow = width < 6;
                return (
                  <div
                    key={event.id}
                    className={`tl-event${isConflict ? ' conflict' : ''}${
                      isNarrow ? ' is-narrow' : ''
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: `${top}px`,
                      background: event.characterColor,
                    }}
                    data-tip={tip}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      // 与原型保持一致：仅 hover tooltip，不弹出模态
                      // 此处保留可点击焦点，方便键盘可达性
                    }}
                  >
                    <span className="ev-name">{event.eventName}</span>
                    {!isNarrow && (
                      <span className="ev-time">
                        {event.startTime}–{event.endTime}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
