/**
 * 关系图组件（T178）
 *
 * 基于 AntV G6 v5 实现的人物关系图：
 *   - 3 种布局：力导向 / 环形 / 层级
 *   - 节点：角色色描边 + 姓名 + 角色标签
 *   - 明线实线金色 (#b08d57)
 *   - 暗线虚线朱砂 (#8a1c1c)
 *   - 节点拖拽、画布缩放平移
 *   - 节点点击选中、双击连线编辑
 *
 * 通过动态 import G6 避免 SSR 问题（G6 依赖 canvas / DOM）。
 */
'use client';

import { useEffect, useMemo, useRef } from 'react';
import type {
  RelationEdge,
  RelationGraphData,
  RelationNode,
} from '@/lib/services/relation-extractor';

/** 布局类型：force 力导向 / radial 环形 / tree 层级 */
export type RelationLayout = 'force' | 'radial' | 'tree';

export interface RelationGraphProps {
  /** 图谱数据 */
  data: RelationGraphData;
  /** 当前布局 */
  layout: RelationLayout;
  /** 是否显示明线 */
  showLight: boolean;
  /** 是否显示暗线 */
  showDark: boolean;
  /** 是否显示关系标签 */
  showLabel: boolean;
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 节点点击回调 */
  onNodeSelect?: (node: RelationNode) => void;
  /** 边双击回调（用于触发编辑） */
  onEdgeEdit?: (edge: RelationEdge) => void;
}

/** 明线 / 暗线颜色（与原型 SVG 一致） */
const LIGHT_COLOR = '#b08d57';
const DARK_COLOR = '#8a1c1c';
/** 节点填充色 */
const NODE_FILL = '#fdf8f0';
/** 节点姓名色 */
const NAME_COLOR = '#2a1d12';
/** 背景色 */
const BG_COLOR = '#f7ecdc';
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 540;
const GRAPH_CENTER_X = SVG_WIDTH / 2;
const GRAPH_CENTER_Y = SVG_HEIGHT / 2;

interface PositionedNode extends RelationNode {
  x: number;
  y: number;
}

/**
 * 将业务节点 / 边转换为 G6 格式
 */
function toG6Data(
  data: RelationGraphData,
  showLight: boolean,
  showDark: boolean,
  showLabel: boolean,
) {
  const nodes = data.nodes.map((n) => ({
    id: n.id,
    type: 'circle',
    data: { ...n },
    style: {
      size: n.radius * 2,
      fill: NODE_FILL,
      stroke: n.color,
      lineWidth: 2,
      labelText: n.name,
      labelFill: NAME_COLOR,
      labelFontSize: 12,
      labelFontWeight: 700,
      labelFontFamily: 'Noto Serif SC, serif',
      labelPosition: 'center',
      // 副标签：角色身份
      badgeText: n.roleIdentity,
      badgeFill: n.color,
      badgeFontSize: 9,
      badgeFontFamily: 'Courier Prime, monospace',
      badgePadding: [2, 4],
      badgePosition: 'bottom',
    },
  }));

  const edges = data.edges
    .filter((e) => {
      if (e.isVisible && showLight) return true;
      if (e.isHiddenRelation && showDark) return true;
      return false;
    })
    .map((e) => {
      const isDark = e.isHiddenRelation;
      const labelText = showLabel
        ? isDark
          ? e.hiddenLabel
          : e.label
        : '';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        data: { ...e },
        style: {
          stroke: isDark ? DARK_COLOR : LIGHT_COLOR,
          strokeWidth: isDark ? 1.3 : 1.5,
          lineDash: isDark ? [5, 4] : undefined,
          opacity: 0.85,
          endArrow: false,
          labelText: labelText || undefined,
          labelFill: isDark ? DARK_COLOR : LIGHT_COLOR,
          labelFontSize: 10,
          labelFontFamily: 'Courier Prime, monospace',
          labelBackground: true,
          labelBackgroundFill: '#fffaf2',
          labelBackgroundOpacity: 0.92,
          labelBackgroundPadding: [1, 4],
          labelBackgroundRadius: 2,
        },
      };
    });

  return { nodes, edges };
}

/**
 * 根据 layout 类型构造 G6 布局配置
 */
function buildLayoutConfig(layout: RelationLayout) {
  switch (layout) {
    case 'force':
      return {
        type: 'force',
        preventOverlap: true,
        nodeSize: 60,
        nodeStrength: -150,
        linkDistance: 160,
        collideStrength: 0.8,
        alpha: 0.3,
      };
    case 'radial':
      return {
        type: 'radial',
        unitRadius: 110,
        preventOverlap: true,
        nodeSize: 60,
        strictRadial: false,
      };
    case 'tree':
      return {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 40,
        ranksep: 80,
      };
    default:
      return { type: 'force' };
  }
}

function buildSvgNodes(
  nodes: RelationNode[],
  edges: RelationEdge[],
  layout: RelationLayout,
): PositionedNode[] {
  if (nodes.length === 0) return [];
  const hub = getHubNode(nodes, edges);

  if (layout === 'tree') {
    const centerX = GRAPH_CENTER_X;
    const topY = 96;
    const bottomY = 340;
    const root = hub ?? nodes[0];
    const rest = nodes.filter((node) => node.id !== root.id);
    const gap = rest.length > 1 ? 720 / (rest.length - 1) : 0;
    return [
      { ...root, x: centerX, y: topY },
      ...rest.map((node, index) => ({
        ...node,
        x: rest.length === 1 ? centerX : 140 + gap * index,
        y: bottomY + (index % 2) * 42,
      })),
    ];
  }

  const root = hub ?? nodes[0];
  const rest = nodes.filter((node) => node.id !== root.id);
  if (rest.length === 0) return [{ ...root, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y }];

  const radiusX = layout === 'force' ? 330 : 315;
  const radiusY = layout === 'force' ? 155 : 172;
  const startAngle = -Math.PI / 2;

  return [
    { ...root, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y - 8 },
    ...rest.map((node, index) => {
      const angle = startAngle + (Math.PI * 2 * index) / rest.length;
      const offset = layout === 'force' && index % 2 === 1 ? 22 : 0;
      const yBias = Math.sin(angle) > 0.75 ? -18 : 0;
      return {
        ...node,
        x: GRAPH_CENTER_X + Math.cos(angle) * (radiusX - offset),
        y: GRAPH_CENTER_Y - 8 + Math.sin(angle) * (radiusY + offset / 2) + yBias,
      };
    }),
  ];
}

function getHubNode(nodes: RelationNode[], edges: RelationEdge[]): RelationNode | null {
  if (!nodes.length) return null;
  if (!edges.length) return nodes.find((node) => node.isMurderer) ?? nodes[0];
  const counts = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  });
  return [...nodes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0] ?? null;
}

function edgeLabel(edge: RelationEdge): string {
  return edge.isHiddenRelation ? edge.hiddenLabel || '暗线' : edge.label || '明线';
}

function edgePath(source: PositionedNode, target: PositionedNode, index: number): string {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy) || 1;
  const curve = index % 2 === 0 ? 22 : -22;
  const controlX = midX + (-dy / len) * curve;
  const controlY = midY + (dx / len) * curve;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function edgeLabelPosition(source: PositionedNode, target: PositionedNode, index: number) {
  const t = 0.48;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy) || 1;
  const offset = index % 2 === 0 ? 18 : -18;
  return {
    x: source.x + dx * t + (-dy / len) * offset,
    y: source.y + dy * t + (dx / len) * offset,
  };
}

/**
 * 关系图组件
 */
export default function RelationGraph({
  data,
  layout,
  showLight,
  showDark,
  showLabel,
  selectedNodeId,
  onNodeSelect,
  onEdgeEdit,
}: RelationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<unknown>(null);
  const callbacksRef = useRef({ onNodeSelect, onEdgeEdit });
  const svgNodes = useMemo(
    () => buildSvgNodes(data.nodes, data.edges, layout),
    [data.edges, data.nodes, layout],
  );
  const svgNodeById = useMemo(
    () => new Map(svgNodes.map((node) => [node.id, node])),
    [svgNodes],
  );
  const svgEdges = useMemo(
    () =>
      data.edges.filter((edge) => {
        if (!svgNodeById.has(edge.source) || !svgNodeById.has(edge.target)) return false;
        if (edge.isVisible && showLight) return true;
        if (edge.isHiddenRelation && showDark) return true;
        return false;
      }),
    [data.edges, showDark, showLight, svgNodeById],
  );
  // 同步最新回调（避免每次重建 graph）
  callbacksRef.current = { onNodeSelect, onEdgeEdit };

  // ===== 初始化 G6 图（仅一次）=====
  useEffect(() => {
    let cancelled = false;

    const initGraph = async () => {
      if (!containerRef.current) return;
      try {
        // 动态 import G6，避免 SSR / 构建期依赖 canvas
        const G6 = await import('@antv/g6');
        if (cancelled || !containerRef.current) return;

        const GraphClass = (G6 as { Graph: new (cfg: Record<string, unknown>) => unknown }).Graph;
        const graph = new GraphClass({
          container: containerRef.current,
          width: containerRef.current.clientWidth || 720,
          height: containerRef.current.clientHeight || 540,
          autoFit: 'view',
          background: BG_COLOR,
          data: toG6Data(data, showLight, showDark, showLabel),
          layout: buildLayoutConfig(layout),
          node: {
            type: 'circle',
            state: {
              selected: {
                shadowColor: LIGHT_COLOR,
                shadowBlur: 16,
                lineWidth: 3,
              },
            },
          },
          edge: {
            type: 'line',
            state: {
              selected: {
                strokeWidth: 2.5,
              },
            },
          },
          behaviors: [
            'drag-canvas',
            'zoom-canvas',
            'drag-element',
            {
              type: 'click-select',
              multiple: false,
            },
          ],
          plugins: [
            {
              type: 'tooltip',
              getContent: (e: { targetType: string; target: { data?: Record<string, unknown> } }) => {
                if (e.targetType === 'node' && e.target?.data) {
                  const d = e.target.data;
                  return `<div style="padding:6px 8px;font-size:12px;color:#2a1d12;background:#fffaf2;border:1px solid ${d.color ?? '#b08d57'};border-radius:2px;">${d.name ?? ''} · ${d.roleIdentity ?? ''}</div>`;
                }
                return '';
              },
            },
          ],
        });

        graphRef.current = graph;

        // 渲染
        const renderable = graph as unknown as {
          render: () => Promise<void>;
          on: (event: string, handler: (e: unknown) => void) => void;
        };
        await renderable.render();

        // 节点点击：触发选中
        renderable.on('node:click', (evt: unknown) => {
          const e = evt as {
            target: { id?: string; data?: RelationNode };
          };
          const nodeData = e?.target?.data;
          const nodeId = e?.target?.id ?? nodeData?.id;
          if (nodeId && nodeData) {
            callbacksRef.current.onNodeSelect?.(nodeData);
          }
        });

        // 边双击：触发编辑
        renderable.on('edge:dblclick', (evt: unknown) => {
          const e = evt as {
            target: { id?: string; data?: RelationEdge };
          };
          const edgeData = e?.target?.data;
          if (edgeData) {
            callbacksRef.current.onEdgeEdit?.(edgeData);
          }
        });
      } catch (err) {
        // G6 初始化失败时静默降级（不影响页面其他部分）
        console.error('[RelationGraph] G6 init failed:', err);
      }
    };

    initGraph();

    return () => {
      cancelled = true;
      // 销毁图实例
      const graph = graphRef.current;
      if (graph) {
        try {
          (graph as { destroy?: () => void }).destroy?.();
        } catch {
          // ignore
        }
        graphRef.current = null;
      }
    };
    // 仅在挂载时初始化一次；data/layout 等变化走下方 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 数据 / 显隐变化时重新设置数据并重绘 =====
  useEffect(() => {
    const graph = graphRef.current as
      | {
          setData: (data: unknown) => void;
          render: () => Promise<void>;
          draw: () => Promise<void>;
        }
      | null;
    if (!graph) return;
    try {
      graph.setData(toG6Data(data, showLight, showDark, showLabel));
      void graph.render();
    } catch (err) {
      console.error('[RelationGraph] setData failed:', err);
    }
  }, [data, showLight, showDark, showLabel]);

  // ===== 布局变化时切换布局 =====
  useEffect(() => {
    const graph = graphRef.current as
      | { setLayout: (layout: unknown) => void; draw: () => Promise<void> }
      | null;
    if (!graph) return;
    try {
      graph.setLayout(buildLayoutConfig(layout));
      void graph.draw();
    } catch (err) {
      console.error('[RelationGraph] setLayout failed:', err);
    }
  }, [layout]);

  // ===== 选中节点变化时更新状态 =====
  useEffect(() => {
    const graph = graphRef.current as
      | {
          setElementState?: (id: string, state: string[], animation?: boolean) => Promise<void>;
        }
      | null;
    if (!graph) return;
    try {
      if (!graph.setElementState) return;
      // G6 v5 使用 setElementState，空数组表示清除状态。
      void Promise.all(
        data.nodes.map((n) =>
          graph.setElementState!(
            n.id,
            n.id === selectedNodeId ? ['selected'] : [],
            false,
          ),
        ),
      )
        .catch((err: unknown) => {
          console.error('[RelationGraph] setElementState failed:', err);
        });
    } catch (err) {
      console.error('[RelationGraph] setElementState failed:', err);
    }
  }, [selectedNodeId, data.nodes]);

  return (
    <div
      className="relation-graph-container"
      ref={containerRef}
      role="img"
      aria-label="人物关系图"
      style={{ width: '100%', height: '100%', minHeight: 540 }}
    >
      <svg
        className="relation-graph-svg"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="relation-node-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#7a5c3a" floodOpacity="0.16" />
          </filter>
        </defs>

        <g className="relation-svg-edges">
          {svgEdges.map((edge, index) => {
            const source = svgNodeById.get(edge.source);
            const target = svgNodeById.get(edge.target);
            if (!source || !target) return null;
            const isDark = edge.isHiddenRelation;
            const label = edgeLabel(edge);
            const labelPos = edgeLabelPosition(source, target, index);
            const labelWidth = Math.max(54, Math.min(96, label.length * 15 + 24));
            return (
              <g key={edge.id} className="relation-svg-edge">
                <path
                  d={edgePath(source, target, index)}
                  fill="none"
                  stroke={isDark ? DARK_COLOR : LIGHT_COLOR}
                  strokeWidth={isDark ? 2.1 : 2.8}
                  strokeDasharray={isDark ? '8 7' : undefined}
                  strokeLinecap="round"
                  opacity={isDark ? 0.72 : 0.84}
                  onDoubleClick={() => onEdgeEdit?.(edge)}
                />
                {showLabel ? (
                  <g
                    className="relation-svg-edge-label"
                    transform={`translate(${labelPos.x}, ${labelPos.y})`}
                    onDoubleClick={() => onEdgeEdit?.(edge)}
                  >
                    <rect
                      x={-labelWidth / 2}
                      y={-12}
                      width={labelWidth}
                      height={23}
                      rx={11.5}
                      fill="#fffaf2"
                      stroke={isDark ? DARK_COLOR : LIGHT_COLOR}
                      opacity={0.96}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isDark ? DARK_COLOR : LIGHT_COLOR}
                      fontSize={12}
                      fontWeight={600}
                      fontFamily="Noto Serif SC, serif"
                    >
                      {label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>

        <g className="relation-svg-nodes">
          {svgNodes.map((node) => {
            const selected = node.id === selectedNodeId;
            const badgeWidth = Math.max(62, Math.min(104, (node.roleIdentity || '角色').length * 14 + 26));
            return (
              <g
                key={node.id}
                className={`relation-svg-node ${selected ? 'selected' : ''}`}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onNodeSelect?.(node)}
              >
                <circle
                  r={node.radius + 8}
                  fill="rgba(253, 248, 240, 0.72)"
                  stroke={selected ? LIGHT_COLOR : 'rgba(122, 92, 58, 0.22)'}
                  strokeWidth={selected ? 2 : 1}
                />
                <circle
                  r={node.radius}
                  fill={NODE_FILL}
                  stroke={node.color}
                  strokeWidth={selected ? 3.6 : 2.4}
                  filter="url(#relation-node-shadow)"
                />
                <circle
                  r={Math.max(8, node.radius - 8)}
                  fill="none"
                  stroke="rgba(122, 92, 58, 0.16)"
                  strokeWidth={1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={NAME_COLOR}
                  fontSize={14}
                  fontWeight={800}
                  fontFamily="Noto Serif SC, serif"
                >
                  {node.name}
                </text>
                <g transform={`translate(0, ${node.radius + 16})`}>
                  <rect
                    x={-badgeWidth / 2}
                    y={-11}
                    width={badgeWidth}
                    height={22}
                    rx={4}
                    fill={node.color}
                    opacity={0.92}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fffaf2"
                    fontSize={11}
                    fontFamily="Noto Serif SC, serif"
                  >
                    {node.roleIdentity || '角色'}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
