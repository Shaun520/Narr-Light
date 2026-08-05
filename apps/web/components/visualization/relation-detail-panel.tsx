/**
 * 节点详情面板组件（T181）
 *
 * 参考 docs/prototype/relationship-graph.html 侧边栏结构：
 *   1. 选中人物卡：大尺寸头像（图片优先，fallback 姓氏首字）+ 姓名 + 角色标签
 *   2. 基础信息：年龄、性格、身份描述
 *   3. 核心秘密：个人任务包装为暗红色边框盒子
 *   4. 关系网络：对方头像/首字 + 关系类型（明线/暗线）+ 关系标签
 *   5. AI 关系调整快捷指令
 *
 * 未选中节点时显示引导空状态。
 */
import { Sparkles, FileText, Target } from 'lucide-react';
import {
  RELATION_STRENGTH_LABEL,
  type RelationEdge,
  type RelationNode,
} from '@/lib/services/relation-extractor';

export interface RelationDetailPanelProps {
  /** 当前选中节点（null 表示未选中） */
  node: RelationNode | null;
  /** 全部边（用于筛选当前节点的关联关系） */
  edges: RelationEdge[];
  /** 全部节点（用于查询关系对端节点的姓名） */
  nodes: RelationNode[];
  /** 点击关联关系项时回调 */
  onRelationClick?: (edge: RelationEdge) => void;
  /** 点击 AI 快捷指令时回调 */
  onQuickPrompt?: (prompt: string) => void;
  /** 点击"跳转剧本"时回调 */
  onJumpToScript?: (nodeId: string) => void;
  /** 点击"聚焦"时回调 */
  onFocusNode?: (nodeId: string) => void;
}

/**
 * 节点详情面板
 */
export default function RelationDetailPanel({
  node,
  edges,
  nodes,
  onRelationClick,
  onQuickPrompt,
  onJumpToScript,
  onFocusNode,
}: RelationDetailPanelProps) {
  // 未选中节点：空状态
  if (!node) {
    return (
      <div className="side-panel">
        <div className="card rel-empty-card">
          <div className="card-body rel-empty-body">
            <div className="rel-empty-avatar" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="rel-empty-title">点击图谱中的人物节点</div>
            <div className="rel-empty-desc">查看身份、秘密与关系详情</div>
          </div>
        </div>
      </div>
    );
  }

  // 节点关联关系
  const relatedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  // AI 快捷指令
  const quickPrompts = buildQuickPrompts(node, relatedEdges, nodes);

  return (
    <div className="side-panel">
      {/* ===== 选中人物卡 ===== */}
      <div className="card rel-character-card">
        <div className="card-body rel-character-body">
          <div className="rel-character-head">
            <div
              className="rel-character-avatar"
              style={{ borderColor: 'var(--rel-gold-light)' }}
              aria-hidden
            >
              {node.image ? (
                <img src={node.image} alt={node.name} />
              ) : (
                <span style={{ color: 'var(--rel-gold-light)' }}>
                  {node.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="rel-character-info">
              <div className="rel-character-name">{node.name}</div>
              <div className="rel-character-role">{node.roleIdentity}</div>
            </div>
          </div>

          <div className="rel-character-meta">
            {node.age ? (
              <div className="rel-meta-row">
                <span className="rel-meta-label">年龄</span>
                <span className="rel-meta-value">{node.age} 岁</span>
              </div>
            ) : null}
            {node.personality ? (
              <div className="rel-meta-row">
                <span className="rel-meta-label">性格</span>
                <span className="rel-meta-value">{node.personality}</span>
              </div>
            ) : null}
            {node.backgroundStory ? (
              <div className="rel-meta-row">
                <span className="rel-meta-label">身份</span>
                <span className="rel-meta-value">{node.backgroundStory}</span>
              </div>
            ) : null}
          </div>

          {node.personalTask ? (
            <div className="rel-secret-box">
              <div className="rel-secret-label">核心秘密 / 个人任务</div>
              <div className="rel-secret-text">{node.personalTask}</div>
            </div>
          ) : null}

          <div className="rel-character-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onJumpToScript?.(node.id)}
            >
              <FileText size={13} />
              跳转剧本
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onFocusNode?.(node.id)}
            >
              <Target size={13} />
              聚焦
            </button>
          </div>
        </div>
      </div>

      {/* ===== 关系网络 ===== */}
      <div className="card rel-relations-card">
        <div className="card-head">
          <h3>
            关系网络 <span className="count">{relatedEdges.length}</span>
          </h3>
        </div>
        <div className="card-body rel-list">
          {relatedEdges.length === 0 ? (
            <div className="rel-empty">暂无关联关系</div>
          ) : (
            relatedEdges.map((edge) => {
              const otherId = edge.source === node.id ? edge.target : edge.source;
              const other = nodes.find((n) => n.id === otherId);
              const otherName = other?.name ?? '未知';
              const isDark = edge.isHiddenRelation;
              const label = isDark
                ? edge.hiddenLabel || '暗线'
                : edge.label || '明线';
              return (
                <div
                  key={edge.id}
                  className="rel-list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => onRelationClick?.(edge)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRelationClick?.(edge);
                    }
                  }}
                >
                  <div
                    className="rel-list-avatar"
                    style={{ borderColor: 'var(--rel-gold-light)' }}
                    aria-hidden
                  >
                    {other?.image ? (
                      <img src={other.image} alt={otherName} />
                    ) : (
                      <span style={{ color: 'var(--rel-gold-light)' }}>
                        {otherName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="rel-list-content">
                    <div className="rel-list-target">{otherName}</div>
                    <div className="rel-list-desc">
                      <span className={`rel-type ${isDark ? 'dark' : 'light'}`}>
                        {isDark ? '暗线' : '明线'}
                      </span>
                      <span className="rel-list-label">{label}</span>
                    </div>
                  </div>
                  <span
                    className="rel-strength"
                    style={
                      edge.strength === 'fatal'
                        ? { color: 'var(--rel-blood-bright)' }
                        : undefined
                    }
                  >
                    {RELATION_STRENGTH_LABEL[edge.strength]}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===== AI 关系调整快捷指令 ===== */}
      <div className="ai-adjust-box">
        <h4>
          <Sparkles />
          关系调整
        </h4>
        {quickPrompts.map((prompt) => (
          <div
            key={prompt}
            className="quick-prompt"
            role="button"
            tabIndex={0}
            onClick={() => onQuickPrompt?.(prompt)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onQuickPrompt?.(prompt);
              }
            }}
          >
            {prompt}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 基于当前节点生成 AI 关系调整快捷指令。
 */
function buildQuickPrompts(
  node: RelationNode,
  edges: RelationEdge[],
  allNodes: RelationNode[],
): string[] {
  const prompts: string[] = [];

  if (node.roleIdentity.includes('死')) {
    const outsider = allNodes.find(
      (n) => n.id !== node.id && n.camp === 'outsider',
    );
    if (outsider) {
      prompts.push(`新增${node.name}与${outsider.name}的暗线：私采乌头`);
    }
  }

  const hasConspiracy = edges.some(
    (e) => e.isHiddenRelation && e.hiddenLabel.includes('共谋'),
  );
  if (hasConspiracy) {
    prompts.push('将"共谋"关系改为单向知情');
  }

  const hasLightColleague = edges.some(
    (e) => e.isVisible && e.relationType === 'colleague',
  );
  if (hasLightColleague) {
    prompts.push(`弱化${node.name}明线，转为旁观者`);
  }

  if (prompts.length === 0) {
    prompts.push(`为${node.name}新增一条暗线关系`);
  }

  return prompts.slice(0, 3);
}
