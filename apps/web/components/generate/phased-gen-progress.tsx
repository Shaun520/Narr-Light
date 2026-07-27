/**
 * 鍒嗛樁娈电敓鎴愯繘搴︾湅鏉?
 *
 * 鏇挎崲 gen-progress.tsx 鐨?Mock 杩涘害鏉★紝鍩轰簬鐪熷疄 PhasedGenerationState 娓叉煋 7 闃舵杩涘害銆?
 * - 姣忛樁娈电嫭绔嬭繘搴︽潯 + 鐘舵€佸浘鏍囷紙鉁?瀹屾垚 / 鈻?杩愯涓?/ 鈴?寰呭惎鍔?/ 鉁?澶辫触锛?
 * - 闃舵 2 瑙掕壊鍓ф湰灞曞紑鏄剧ず鍚勮鑹插瓙鐘舵€?
 * - 澶辫触闃舵闄勯敊璇師鍥犱笌閲嶈瘯鎸夐挳
 * - 娴佸紡鍐呭棰勮锛堝彲鎶樺彔锛?
 */
'use client';

import React, { useState } from 'react';
import type {
  PhasedGenerationState,
  PhaseState,
  PhaseId,
  PhaseSubItem,
} from '@/lib/hooks/use-phased-generation';

export interface PhasedGenProgressProps {
  /** 缂栨帓鍣ㄧ姸鎬?*/
  state: PhasedGenerationState;
  /** 閲嶈瘯鎸囧畾闃舵 */
  onRetryPhase: (phaseId: PhaseId) => void;
}

const PHASE_DISPLAY_ORDER: PhaseId[] = [
  'story_bible',
  'character_profiles',
  'act_structure',
  'character_script',
  'clues',
  'organizer_manual',
  'truth_review',
  'timeline_structure',
];

const PHASE_LABELS: Record<PhaseId, string> = {
  story_bible: '设定本',
  character_profiles: '人物设定',
  act_structure: '分幕结构',
  character_script: '玩家剧本',
  clues: '线索卡',
  organizer_manual: '组织者手册',
  truth_review: '真相复盘',
  timeline_structure: '时间线结构化',
};

function getStatusIcon(status: PhaseState['status']): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'running':
      return '…';
    case 'failed':
      return '✕';
    case 'skipped':
      return '-';
    default:
      return '⏳';
  }
}

function getStatusColor(status: PhaseState['status']): string {
  switch (status) {
    case 'completed':
      return 'var(--jade, #5a8a6a)';
    case 'running':
      return 'var(--blood-soft, #c54848)';
    case 'failed':
      return 'var(--blood, #a02828)';
    default:
      return 'var(--ink-soft, #888)';
  }
}

function getStatusText(status: PhaseState['status']): string {
  switch (status) {
    case 'completed':
      return '完成';
    case 'running':
      return '生成中';
    case 'failed':
      return '失败';
    case 'skipped':
      return '跳过';
    default:
      return '等待';
  }
}

function getSubItemPartLabel(label: string): string {
  const part = label.split('·').slice(1).join('·').trim();
  return part || label;
}

function getSubItemCharacterName(label: string): string {
  return label.split('·')[0]?.trim() || '玩家本';
}

function groupCharacterScriptItems(items: PhaseSubItem[]) {
  const groups: Array<{ characterName: string; items: PhaseSubItem[] }> = [];
  const groupMap = new Map<string, PhaseSubItem[]>();

  for (const item of items) {
    const characterName = getSubItemCharacterName(item.label);
    const group = groupMap.get(characterName) ?? [];
    group.push(item);
    groupMap.set(characterName, group);
  }

  for (const [characterName, groupItems] of groupMap.entries()) {
    groups.push({ characterName, items: groupItems });
  }

  return groups;
}

function PhaseSubItemMatrix({ items }: { items: PhaseSubItem[] }) {
  const runningItems = items.filter((item) => item.status === 'running');
  const failedItems = items.filter((item) => item.status === 'failed');
  const groupedItems = groupCharacterScriptItems(items);

  return (
    <div className="phased-script-matrix">
      {(runningItems.length > 0 || failedItems.length > 0) && (
        <div className="phased-script-active">
          {runningItems.length > 0 && (
            <span>正在生成：{runningItems.map((item) => item.label).join('、')}</span>
          )}
          {failedItems.length > 0 && (
            <span>失败：{failedItems.map((item) => item.label).join('、')}</span>
          )}
        </div>
      )}

      <div className="phased-script-grid">
        {groupedItems.map((group) => (
          <div key={group.characterName} className="phased-script-row">
            <div className="phased-script-name">{group.characterName}</div>
            <div className="phased-script-parts">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`phased-script-pill ${item.status}`}
                  title={item.error ? `${item.label}: ${item.error}` : `${item.label}: ${getStatusText(item.status)}`}
                >
                  <span className="phased-script-dot" />
                  <span className="phased-script-part">{getSubItemPartLabel(item.label).replace('玩家剧本', '')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {failedItems.length > 0 && (
        <div className="phased-script-errors">
          {failedItems.map((item) => (
            <div key={item.id}>{item.label}: {item.error ?? '生成失败'}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseRow({
  phase,
  onRetry,
}: {
  phase: PhaseState;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasStreamText = phase.streamedText.length > 0;
  const hasSubItems = phase.subItems && phase.subItems.length > 0;
  const canExpand = phase.status === 'running' || hasStreamText || hasSubItems || Boolean(phase.error);

  return (
    <div className="phased-phase-row">
      <div
        className="phased-phase-header"
        onClick={() => canExpand && setExpanded(!expanded)}
        style={{ cursor: canExpand ? 'pointer' : 'default' }}
      >
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? '收起' : '展开'}${PHASE_LABELS[phase.id]}`}
          className="phased-phase-toggle"
          disabled={!canExpand}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (canExpand) setExpanded((value) => !value);
          }}
        >
          {canExpand ? (expanded ? '▼' : '▶') : getStatusIcon(phase.status)}
        </button>
        <span className="phased-phase-label">
          {PHASE_LABELS[phase.id]}
          {phase.id === 'character_script' && hasSubItems && (
            <span className="phased-phase-count">
              {' '}
              {phase.subItems!.filter((s) => s.status === 'completed').length}/
              {phase.subItems!.length}
            </span>
          )}
        </span>
        {phase.status === 'running' && (
          <span className="phased-phase-percent">{phase.percent}%</span>
        )}
        {phase.status === 'completed' && phase.durationSeconds && (
          <span className="phased-phase-meta">· {phase.durationSeconds}s</span>
        )}
        {phase.mode && (
          <span className="phased-phase-meta">
            {' '}
            {phase.mode}
            {phase.model ? ` ${phase.model}` : ''}
          </span>
        )}
        {phase.status === 'failed' && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            重试
          </button>
        )}
      </div>

      {(phase.status === 'running' || phase.status === 'failed') &&
        phase.percent > 0 && (
          <div className="gen-progress-bar">
            <div
              className="gen-progress-fill"
              style={{
                width: `${phase.percent}%`,
                background: getStatusColor(phase.status),
              }}
            />
          </div>
        )}

      {phase.status === 'failed' && phase.error && (
        <div className="phased-phase-error">{phase.error}</div>
      )}

      {expanded && hasSubItems && (
        phase.id === 'character_script' ? (
          <PhaseSubItemMatrix items={phase.subItems!} />
        ) : (
          <div className="phased-subitems">
            {phase.subItems!.map((sub) => (
              <div key={sub.id} className="phased-subitem">
                <span className="phased-subitem-status" style={{ color: getStatusColor(sub.status) }}>
                  {getStatusIcon(sub.status)}
                </span>
                <span>{sub.label}</span>
                {sub.status === 'failed' && sub.error && (
                  <span className="phased-subitem-error">{sub.error}</span>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {expanded && hasStreamText && (
        <pre className="phased-stream-preview">
          {phase.streamedText.slice(-2000)}
        </pre>
      )}

      {expanded && phase.status === 'running' && !hasStreamText && !hasSubItems && (
        <div className="phased-stream-empty">正在等待模型返回内容...</div>
      )}
    </div>
  );
}

export function PhasedGenProgress({ state, onRetryPhase }: PhasedGenProgressProps) {
  return (
    <div className="phased-gen-progress">
      {PHASE_DISPLAY_ORDER.map((phaseId) => (
        <PhaseRow
          key={phaseId}
          phase={state.phases[phaseId]}
          onRetry={() => onRetryPhase(phaseId)}
        />
      ))}
      {state.globalError && (
        <div className="phased-global-error">{state.globalError}</div>
      )}
    </div>
  );
}
