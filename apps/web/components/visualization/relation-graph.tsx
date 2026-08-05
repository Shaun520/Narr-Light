/**
 * 关系图组件（T178）
 *
 * 基于 D3.js v7 + SVG 实现的人物关系图：
 *   - 3 种布局：力导向 / 环形 / 层级
 *   - 节点：角色头像（优先真实图片，fallback 姓氏首字）+ 姓名 + 角色标签
 *   - 明线实线青色 (#40916c)
 *   - 暗线虚线紫色 (#8b4d8b)
 *   - 节点描边统一金色 (#d4a853)
 *   - 节点拖拽、画布缩放平移
 *   - 节点点击选中、边双击编辑
 *   - 底部图例、操作提示
 *
 * 设计严格参考 docs/prototype/relationship-graph.html 的沉浸式复古悬疑风格。
 */
'use client';

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
} from 'react';
import * as d3 from 'd3';
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
  /** 背景点击回调（用于取消选中） */
  onBackgroundClick?: () => void;
}

export interface RelationGraphRef {
  /** 重置画布缩放与位置 */
  resetZoom: () => void;
  /** 聚焦到指定节点 */
  focusNode: (nodeId: string) => void;
}

/** 明线 / 暗线颜色（与原型 SVG 一致：青为明线，紫为暗线） */
const LIGHT_COLOR = '#40916c';
const DARK_COLOR = '#8b4d8b';
/** 节点填充色（浅色主题下使用深色） */
const NODE_FILL = '#1c1915';
/** 节点边框色（对齐原型金色光晕） */
const NODE_STROKE = '#b8860b';
/** 节点姓名色（浅色主题下使用深色，确保可读性） */
const NAME_COLOR = '#1a120b';

interface PositionedNode extends RelationNode {
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

type RenderEdge = Omit<RelationEdge, 'source' | 'target'> & {
  source: PositionedNode;
  target: PositionedNode;
  /** 原始边数据（用于回调，保持 source/target 为字符串） */
  original: RelationEdge;
};

const NODE_BASE_RADIUS = 34;
const LINK_DISTANCE = 260;

/**
 * 将关系边与定位后的节点关联（D3 会修改 source/target 为节点对象）。
 */
function bindEdges(
  edges: RelationEdge[],
  nodeById: Map<string, PositionedNode>,
): RenderEdge[] {
  return edges
    .map((e) => {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (!source || !target) return null;
      return { ...e, source, target, original: e };
    })
    .filter((e): e is RenderEdge => e !== null);
}

/**
 * 计算树的层级（以连接数最多的节点为根）。
 */
function computeTreeLevels(
  root: PositionedNode,
  links: RenderEdge[],
  allNodes: PositionedNode[],
): Map<string, number> {
  const levels = new Map<string, number>([[root.id, 0]]);
  const queue = [root.id];
  const visited = new Set<string>([root.id]);

  while (queue.length) {
    const current = queue.shift()!;
    links.forEach((l) => {
      const neighborId =
        l.source.id === current
          ? l.target.id
          : l.target.id === current
            ? l.source.id
            : null;
      if (neighborId && !visited.has(neighborId)) {
        visited.add(neighborId);
        levels.set(neighborId, (levels.get(current) ?? 0) + 1);
        queue.push(neighborId);
      }
    });
  }

  allNodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 2);
  });

  return levels;
}

/**
 * 寻找枢纽节点（连接数最多，优先凶手）。
 */
function getHubNode(nodes: PositionedNode[], edges: RenderEdge[]): PositionedNode | null {
  if (!nodes.length) return null;
  if (!edges.length) return nodes.find((n) => n.isMurderer) ?? nodes[0];
  const counts = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((edge) => {
    counts.set(edge.source.id, (counts.get(edge.source.id) ?? 0) + 1);
    counts.set(edge.target.id, (counts.get(edge.target.id) ?? 0) + 1);
  });
  return [...nodes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
}

/**
 * 按中文字符折行，返回可在 badge 内展示的文本行数组。
 * 优先按标点 / 空格切分，限制最大行数，超出追加省略号。
 */
function wrapBadgeText(value: string, maxCharsPerLine: number, maxLines: number): string[] {
  const text = value.trim();
  if (!text) return ['角色'];

  // 优先在标点、空格处切分；否则按字符硬切
  const segments: string[] = [];
  let current = '';
  for (const char of text) {
    if (/[，。、；：！？\s\/]/.test(char)) {
      if (current) segments.push(current);
      segments.push(char);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) segments.push(current);

  const lines: string[] = [];
  let line = '';
  for (const seg of segments) {
    if (/[，。、；：！？\s\/]/.test(seg)) {
      if (line.length + seg.length <= maxCharsPerLine) {
        line += seg;
      } else {
        if (line) lines.push(line);
        line = '';
      }
      continue;
    }

    if (line.length + seg.length <= maxCharsPerLine) {
      line += seg;
    } else {
      if (line) lines.push(line);
      if (seg.length > maxCharsPerLine) {
        lines.push(seg.slice(0, maxCharsPerLine));
        if (lines.length >= maxLines) break;
        line = seg.slice(maxCharsPerLine);
      } else {
        line = seg;
      }
    }

    if (line.length >= maxCharsPerLine) {
      lines.push(line);
      line = '';
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (!lines.length) return [text.slice(0, maxCharsPerLine)];

  // 如果原始文本未完全容纳且已经到最大行数，最后一行追加省略号
  const visibleLen = lines.reduce((sum, l) => sum + l.length, 0);
  if (visibleLen < text.length && lines.length >= maxLines) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.slice(0, maxCharsPerLine - 1) + '…';
  }

  return lines;
}

/**
 * 关系图组件
 */
const RelationGraph = forwardRef<RelationGraphRef, RelationGraphProps>(
  function RelationGraph(
    {
      data,
      layout,
      showLight,
      showDark,
      showLabel,
      selectedNodeId,
      onNodeSelect,
      onEdgeEdit,
      onBackgroundClick,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);
    const simulationRef = useRef<d3.Simulation<PositionedNode, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const dimensionsRef = useRef({ width: 0, height: 0 });
    const callbacksRef = useRef({ onNodeSelect, onEdgeEdit, onBackgroundClick });
    const selectedNodeIdRef = useRef(selectedNodeId);

    // 同步最新回调与选中状态
    callbacksRef.current = { onNodeSelect, onEdgeEdit, onBackgroundClick };
    selectedNodeIdRef.current = selectedNodeId;

    // 可见边
    const visibleEdges = useMemo(
      () =>
        data.edges.filter((e) => {
          if (e.isVisible && showLight) return true;
          if (e.isHiddenRelation && showDark) return true;
          return false;
        }),
      [data.edges, showLight, showDark],
    );

    // 节点深拷贝（D3 会修改 x/y/vx/vy）
    const positionedNodes = useMemo<PositionedNode[]>(() => {
      const count = data.nodes.length;
      const radius = Math.min(320, count * 42 + 80);
      return data.nodes.map((n, i) => ({
        ...n,
        x:
          count === 1
            ? 0
            : Math.cos((2 * Math.PI * i) / Math.max(1, count)) * radius,
        y:
          count === 1
            ? 0
            : Math.sin((2 * Math.PI * i) / Math.max(1, count)) * radius,
      }));
    }, [data.nodes]);

    const nodeById = useMemo(
      () => new Map(positionedNodes.map((n) => [n.id, n])),
      [positionedNodes],
    );

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      resetZoom: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
        transformRef.current = d3.zoomIdentity;
      },
      focusNode: (nodeId: string) => {
        if (!svgRef.current || !gRef.current || !zoomRef.current) return;
        const node = nodeById.get(nodeId);
        if (!node) return;
        const { width, height } = dimensionsRef.current;
        const scale = 1.4;
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(scale)
          .translate(-node.x, -node.y);
        d3.select(svgRef.current)
          .transition()
          .duration(750)
          .call(zoomRef.current.transform, transform);
        transformRef.current = transform;
        callbacksRef.current.onNodeSelect?.(node);
      },
    }));

    // ===== 初始化 D3 =====
    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight || 540;
      dimensionsRef.current = { width, height };

      const svg = d3
        .select(container)
        .append('svg')
        .attr('class', 'relation-graph-svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', '人物关系图')
        .style('cursor', 'grab');

      svgRef.current = svg.node();

      // defs: 箭头 marker + 节点阴影
      const defs = svg.append('defs');

      defs
        .append('marker')
        .attr('id', 'arrow-light')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_BASE_RADIUS + 14)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', LIGHT_COLOR);

      defs
        .append('marker')
        .attr('id', 'arrow-dark')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_BASE_RADIUS + 14)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', DARK_COLOR);

      defs
        .append('filter')
        .attr('id', 'relation-node-shadow')
        .attr('x', '-40%')
        .attr('y', '-40%')
        .attr('width', '180%')
        .attr('height', '180%')
        .append('feDropShadow')
        .attr('dx', 0)
        .attr('dy', 4)
        .attr('stdDeviation', 5)
        .attr('flood-color', '#7a5c3a')
        .attr('flood-opacity', 0.22);

      const g = svg.append('g');
      gRef.current = g.node();

      // 缩放行为
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.35, 2.5])
        .on('zoom', (event) => {
          transformRef.current = event.transform;
          g.attr('transform', event.transform.toString());
        })
        .on('start', () => svg.style('cursor', 'grabbing'))
        .on('end', () => svg.style('cursor', 'grab'));

      zoomRef.current = zoom;
      svg.call(zoom);

      // 背景点击取消选中
      svg.on('click', (event) => {
        if (event.target === svg.node()) {
          callbacksRef.current.onBackgroundClick?.();
        }
      });

      // 窗口大小变化
      const handleResize = () => {
        if (!containerRef.current || !svgRef.current) return;
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight || 540;
        dimensionsRef.current = { width: newWidth, height: newHeight };
        d3.select(svgRef.current)
          .attr('width', newWidth)
          .attr('height', newHeight)
          .attr('viewBox', [0, 0, newWidth, newHeight]);
        restartSimulation();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        simulationRef.current?.stop();
        svg.remove();
        svgRef.current = null;
        gRef.current = null;
        simulationRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== 构建并启动 simulation =====
    const buildSimulation = () => {
      if (!dimensionsRef.current.width) return null;
      const { width, height } = dimensionsRef.current;

      const nodes = positionedNodes;
      const edges = bindEdges(visibleEdges, nodeById);
      const hub = getHubNode(nodes, edges) ?? nodes[0];

      const simulation = d3
        .forceSimulation<PositionedNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<PositionedNode, RenderEdge>(edges)
            .id((d) => d.id)
            .distance(LINK_DISTANCE),
        )
        .force('charge', d3.forceManyBody<PositionedNode>().strength(-860))
        .force('collide', d3.forceCollide<PositionedNode>().radius((d) => (d.radius || NODE_BASE_RADIUS) + 50))
        .alphaDecay(0.02);

      if (layout === 'force') {
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.force('r', null);
        simulation.force('x', null);
        simulation.force('y', null);
      } else if (layout === 'radial') {
        const radius = Math.min(width, height) * 0.4;
        simulation
          .force('link', null)
          .force('charge', d3.forceManyBody<PositionedNode>().strength(-360))
          .force(
            'r',
            d3.forceRadial<PositionedNode>(radius, width / 2, height / 2).strength(0.75),
          )
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('x', null)
          .force('y', null);
      } else if (layout === 'tree') {
        const levels = computeTreeLevels(hub, edges, nodes);
        const maxLevel = Math.max(...levels.values(), 1);
        const levelHeight = Math.max(height / (maxLevel + 1), 160);
        simulation
          .force(
            'link',
            d3
              .forceLink<PositionedNode, RenderEdge>(edges)
              .id((d) => d.id)
              .distance(LINK_DISTANCE * 0.9),
          )
          .force('charge', d3.forceManyBody<PositionedNode>().strength(-420))
          .force(
            'x',
            d3
              .forceX<PositionedNode>((d) => {
                const level = levels.get(d.id) ?? 0;
                const siblings = nodes.filter((n) => (levels.get(n.id) ?? 0) === level);
                const idx = siblings.findIndex((n) => n.id === d.id);
                const count = siblings.length;
                return (width / (count + 1)) * (idx + 1);
              })
              .strength(0.55),
          )
          .force(
            'y',
            d3
              .forceY<PositionedNode>((d) => {
                const level = levels.get(d.id) ?? 0;
                return level * levelHeight + levelHeight * 0.85;
              })
              .strength(0.55),
          )
          .force('center', null)
          .force('r', null);
      }

      return { simulation, nodes, edges };
    };

    const restartSimulation = () => {
      if (!gRef.current) return;
      simulationRef.current?.stop();

      const built = buildSimulation();
      if (!built) return;
      const { simulation, nodes, edges } = built;
      simulationRef.current = simulation;

      const g = d3.select(gRef.current);
      g.selectAll('*').remove();

      // 边 group
      const linkGroup = g.append('g').attr('class', 'relation-svg-edges');
      const linkLabelGroup = g.append('g').attr('class', 'relation-svg-edge-labels');
      const nodeGroup = g.append('g').attr('class', 'relation-svg-nodes');

      // 渲染边
      const linkSel = linkGroup
        .selectAll<SVGPathElement, RenderEdge>('path.relation-svg-edge')
        .data(edges, (d) => (d as RenderEdge).id)
        .join('path')
        .attr('class', (d) => `relation-svg-edge ${d.isHiddenRelation ? 'dark' : 'light'}`)
        .attr('fill', 'none')
        .attr('stroke', (d) => (d.isHiddenRelation ? DARK_COLOR : LIGHT_COLOR))
        .attr('stroke-width', (d) => (d.isHiddenRelation ? 2 : 2.6))
        .attr('stroke-dasharray', (d) => (d.isHiddenRelation ? '8 7' : null))
        .attr('stroke-linecap', 'round')
        .attr('opacity', (d) => (d.isHiddenRelation ? 0.72 : 0.84))
        .attr('marker-end', (d) => `url(#arrow-${d.isHiddenRelation ? 'dark' : 'light'})`)
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          callbacksRef.current.onEdgeEdit?.(d.original);
        });

      // 渲染边标签
      const labelSel = linkLabelGroup
        .selectAll<SVGGElement, RenderEdge>('g.relation-svg-edge-label')
        .data(edges, (d) => (d as RenderEdge).id)
        .join('g')
        .attr('class', 'relation-svg-edge-label')
        .style('display', showLabel ? 'block' : 'none')
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          callbacksRef.current.onEdgeEdit?.(d.original);
        });

      labelSel
        .append('rect')
        .attr('class', 'relation-svg-edge-label-bg')
        .attr('rx', 11.5)
        .attr('ry', 11.5)
        .attr('fill', NODE_FILL)
        .attr('stroke', (d) => (d.isHiddenRelation ? DARK_COLOR : LIGHT_COLOR))
        .attr('opacity', 0.96);

      labelSel
        .append('text')
        .attr('class', 'relation-svg-edge-label-text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#fdf8f0')
        .attr('font-size', 11)
        .attr('font-weight', 700)
        .attr('font-family', 'var(--font-noto-serif-sc), Noto Serif SC, serif')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.4)')
        .text((d) => (d.isHiddenRelation ? d.hiddenLabel || '暗线' : d.label || '明线'));

      // 渲染节点
      const nodeSel = nodeGroup
        .selectAll<SVGGElement, PositionedNode>('g.relation-svg-node')
        .data(nodes, (d) => (d as PositionedNode).id)
        .join('g')
        .attr('class', (d) => `relation-svg-node ${d.id === selectedNodeIdRef.current ? 'selected' : ''}`)
        .style('cursor', 'pointer')
        .call(
          d3
            .drag<SVGGElement, PositionedNode>()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }),
        )
        .on('click', (_event, d) => {
          callbacksRef.current.onNodeSelect?.(d);
        });

      // 节点外圈（选中/悬停反馈）
      nodeSel
        .append('circle')
        .attr('class', 'node-halo')
        .attr('r', (d) => (d.radius || NODE_BASE_RADIUS) + 10)
        .attr('fill', 'rgba(253, 248, 240, 0.85)')
        .attr('stroke', 'rgba(122, 92, 58, 0.3)')
        .attr('stroke-width', 1.5);

      // 节点主体
      nodeSel
        .append('circle')
        .attr('class', 'node-body')
        .attr('r', (d) => d.radius || NODE_BASE_RADIUS)
        .attr('fill', NODE_FILL)
        .attr('stroke', NODE_STROKE)
        .attr('stroke-width', 2.4)
        .attr('filter', 'url(#relation-node-shadow)');

      // 节点 clipPath（用于头像裁剪）
      nodeSel
        .each(function (d) {
          const sel = d3.select(this);
          sel
            .append('defs')
            .append('clipPath')
            .attr('id', `clip-${d.id}`)
            .append('circle')
            .attr('r', (d.radius || NODE_BASE_RADIUS) - 2);
        });

      // 节点头像图片（如果存在 image）
      nodeSel
        .append('image')
        .attr('class', 'node-image')
        .attr('xlink:href', (d) => d.image || '')
        .attr('x', (d) => -(d.radius || NODE_BASE_RADIUS) + 2)
        .attr('y', (d) => -(d.radius || NODE_BASE_RADIUS) + 2)
        .attr('width', (d) => (d.radius || NODE_BASE_RADIUS) * 2 - 4)
        .attr('height', (d) => (d.radius || NODE_BASE_RADIUS) * 2 - 4)
        .attr('clip-path', (d) => `url(#clip-${d.id})`)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .style('opacity', (d) => (d.image ? 1 : 0))
        .on('error', function () {
          d3.select(this).style('opacity', 0);
          const parent = (this as SVGImageElement).parentNode as SVGGElement | null;
          if (parent) {
            d3.select(parent).select('.node-fallback').style('opacity', 1);
          }
        })
        .on('mouseover', function (_event, d) {
          const r = (d.radius || NODE_BASE_RADIUS) - 2;
          d3.select(this)
            .transition()
            .duration(200)
            .attr('x', -r * 1.08)
            .attr('y', -r * 1.08)
            .attr('width', r * 2.16)
            .attr('height', r * 2.16);
        })
        .on('mouseout', function (_event, d) {
          const r = (d.radius || NODE_BASE_RADIUS) - 2;
          d3.select(this)
            .transition()
            .duration(200)
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2);
        });

      // 无图片时的 fallback：姓氏首字
      nodeSel
        .append('text')
        .attr('class', 'node-fallback')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', NODE_STROKE)
        .attr('font-size', (d) => Math.max(16, (d.radius || NODE_BASE_RADIUS) * 0.85))
        .attr('font-weight', 700)
        .attr('font-family', 'var(--font-noto-serif-sc), Noto Serif SC, serif')
        .style('opacity', (d) => (d.image ? 0 : 1))
        .text((d) => d.name.charAt(0));

      // 节点姓名
      nodeSel
        .append('text')
        .attr('class', 'node-name')
        .attr('text-anchor', 'middle')
        .attr('dy', (d) => (d.radius || NODE_BASE_RADIUS) + 28)
        .attr('fill', NAME_COLOR)
        .attr('font-size', 13)
        .attr('font-weight', 800)
        .attr('font-family', 'var(--font-noto-serif-sc), Noto Serif SC, serif')
        .style('text-shadow', '0 1px 0 rgba(255,255,255,0.6)')
        .text((d) => d.name);

      // 节点角色标签
      nodeSel
        .each(function (d) {
          const sel = d3.select(this);
          const lines = wrapBadgeText(d.roleIdentity || '角色', 10, 2);
          const badgeWidth = Math.max(
            74,
            Math.min(140, Math.max(...lines.map((l) => l.length)) * 11.5 + 22),
          );
          const lineHeight = 12;
          const badgeHeight = 16 + lines.length * lineHeight;
          const badgeY = (d.radius || NODE_BASE_RADIUS) + 46 + (lines.length - 1) * 4;
          const gBadge = sel
            .append('g')
            .attr('class', 'node-badge')
            .attr('transform', `translate(0, ${badgeY})`);

          gBadge
            .append('rect')
            .attr('x', -badgeWidth / 2)
            .attr('y', -badgeHeight / 2)
            .attr('width', badgeWidth)
            .attr('height', badgeHeight)
            .attr('rx', 5)
            .attr('fill', d.color)
            .attr('opacity', 0.95)
            .attr('stroke', 'rgba(253, 248, 240, 0.35)')
            .attr('stroke-width', 0.5);

          const textEl = gBadge
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fdf8f0')
            .attr('font-size', 9.5)
            .attr('font-weight', 700)
            .attr('font-family', 'var(--font-noto-serif-sc), Noto Serif SC, serif')
            .style('text-shadow', '0 1px 2px rgba(0,0,0,0.45)');

          lines.forEach((line, i) => {
            textEl
              .append('tspan')
              .attr('x', 0)
              .attr('dy', i === 0 ? -(lines.length - 1) * (lineHeight / 2) : lineHeight)
              .text(line);
          });
        });

      // tick 更新位置
      simulation.on('tick', () => {
        // 限制节点在画布内
        const { width: w, height: h } = dimensionsRef.current;
        nodes.forEach((d) => {
          const r = (d.radius || NODE_BASE_RADIUS) + 56;
          d.x = Math.max(r, Math.min(w - r, d.x));
          d.y = Math.max(r, Math.min(h - r, d.y));
        });

        linkSel.attr('d', (d, i) => {
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.hypot(dx, dy) || 1;
          const curve = i % 2 === 0 ? 22 : -22;
          const controlX = midX + (-dy / len) * curve;
          const controlY = midY + (dx / len) * curve;
          return `M ${d.source.x} ${d.source.y} Q ${controlX} ${controlY} ${d.target.x} ${d.target.y}`;
        });

        labelSel.attr('transform', (d, i) => {
          const t = 0.48;
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.hypot(dx, dy) || 1;
          const offset = i % 2 === 0 ? 18 : -18;
          const x = d.source.x + dx * t + (-dy / len) * offset;
          const y = d.source.y + dy * t + (dx / len) * offset;
          return `translate(${x}, ${y})`;
        });

        labelSel.each(function () {
          const text = d3.select(this).select('text').node() as SVGTextElement | null;
          if (!text) return;
          const bbox = text.getBBox();
          d3.select(this)
            .select('rect')
            .attr('x', bbox.x - 6)
            .attr('y', bbox.y - 4)
            .attr('width', bbox.width + 12)
            .attr('height', bbox.height + 8);
        });

        nodeSel.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
      });
    };

    // ===== 数据 / 显隐 / 布局变化时重启 simulation =====
    useEffect(() => {
      restartSimulation();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positionedNodes, visibleEdges, layout]);

    // ===== 选中节点变化时更新样式 =====
    useEffect(() => {
      if (!gRef.current) return;
      d3.select(gRef.current)
        .selectAll<SVGGElement, PositionedNode>('g.relation-svg-node')
        .classed('selected', (d) => d.id === selectedNodeId);
    }, [selectedNodeId]);

    // ===== 标签显隐 =====
    useEffect(() => {
      if (!gRef.current) return;
      d3.select(gRef.current)
        .selectAll<SVGGElement, RenderEdge>('g.relation-svg-edge-label')
        .style('display', showLabel ? 'block' : 'none');
    }, [showLabel]);

    return (
      <div
        className="relation-graph-container"
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 540 }}
      />
    );
  },
);

export default RelationGraph;
