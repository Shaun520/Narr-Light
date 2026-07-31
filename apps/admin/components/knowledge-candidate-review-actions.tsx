"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  KNOWLEDGE_ABSTRACTION_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  QUALITY_RISK_LEVELS,
} from "@narrlight/shared";
import {
  rejectKnowledgeCandidate,
  updateKnowledgeCandidate,
} from "@/app/(admin)/knowledge/actions";

const GENRES = ["hardcore", "emotion", "horror", "funny", "mechanism"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;

export type CandidateDraft = {
  id: string;
  title: string;
  content: string;
  category: string;
  moduleType: string;
  stage: string;
  genre: string | null;
  playerCountMin: number | null;
  playerCountMax: number | null;
  difficulty: string | null;
  abstractionLevel: string;
  riskLevel: string;
  weight: number;
};

export function CandidateReviewActions({ candidate }: { candidate: CandidateDraft }) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  return (
    <>
      <button className="link-btn" type="button" onClick={() => setEditing(true)}>
        编辑
      </button>
      <button className="link-btn danger" type="button" onClick={() => setRejecting(true)}>
        驳回
      </button>

      {editing && <CandidateEditModal candidate={candidate} onClose={() => setEditing(false)} />}
      {rejecting && <CandidateRejectModal candidateId={candidate.id} onClose={() => setRejecting(false)} />}
    </>
  );
}

function CandidateEditModal({ candidate, onClose }: { candidate: CandidateDraft; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-edit-title">
        <div className="modal-head">
          <div>
            <div className="modal-title" id="candidate-edit-title">编辑候选知识</div>
            <div className="admin-card-sub">调整内容后再批准入库；候选默认不进入生成链路。</div>
          </div>
          <button className="link-btn" type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          <form className="knowledge-form" action={updateKnowledgeCandidate}>
            <input name="id" type="hidden" value={candidate.id} />
            <label className="knowledge-field knowledge-field-full">
              <span>标题</span>
              <input className="input" name="title" required defaultValue={candidate.title} />
            </label>
            <label className="knowledge-field knowledge-field-full">
              <span>内容</span>
              <textarea
                className="textarea knowledge-content-input"
                name="content"
                required
                defaultValue={candidate.content}
              />
            </label>
            <div className="knowledge-grid-3">
              <label className="knowledge-field">
                <span>类型</span>
                <select className="select" name="category" defaultValue={candidate.category}>
                  {KNOWLEDGE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{CATEGORY_LABELS[category] ?? category}</option>
                  ))}
                </select>
              </label>
              <label className="knowledge-field">
                <span>阶段</span>
                <select className="select" name="stage" defaultValue={candidate.stage}>
                  {KNOWLEDGE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{STAGE_LABELS[stage] ?? stage}</option>
                  ))}
                </select>
              </label>
              <label className="knowledge-field">
                <span>模块</span>
                <select className="select" name="moduleType" defaultValue={candidate.moduleType}>
                  {KNOWLEDGE_MODULE_TYPES.map((moduleType) => (
                    <option key={moduleType} value={moduleType}>{MODULE_TYPE_LABELS[moduleType] ?? moduleType}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="knowledge-grid-3">
              <label className="knowledge-field">
                <span>抽象层级</span>
                <select className="select" name="abstractionLevel" defaultValue={candidate.abstractionLevel}>
                  {KNOWLEDGE_ABSTRACTION_LEVELS.map((level) => (
                    <option key={level} value={level}>{ABSTRACTION_LABELS[level] ?? level}</option>
                  ))}
                </select>
              </label>
              <label className="knowledge-field">
                <span>风险</span>
                <select className="select" name="riskLevel" defaultValue={candidate.riskLevel}>
                  {QUALITY_RISK_LEVELS.map((level) => (
                    <option key={level} value={level}>{RISK_LABELS[level] ?? level}</option>
                  ))}
                </select>
              </label>
              <label className="knowledge-field">
                <span>权重</span>
                <input className="input" max={1000} min={0} name="weight" type="number" defaultValue={candidate.weight} />
              </label>
            </div>
            <div className="knowledge-grid-2">
              <label className="knowledge-field">
                <span>题材</span>
                <select className="select" name="genre" defaultValue={candidate.genre ?? ""}>
                  <option value="">通用</option>
                  {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </label>
              <label className="knowledge-field">
                <span>难度</span>
                <select className="select" name="difficulty" defaultValue={candidate.difficulty ?? ""}>
                  <option value="">通用</option>
                  {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                </select>
              </label>
            </div>
            <div className="knowledge-grid-2">
              <label className="knowledge-field">
                <span>最少人数</span>
                <input className="input" max={12} min={1} name="playerCountMin" type="number" defaultValue={candidate.playerCountMin ?? ""} />
              </label>
              <label className="knowledge-field">
                <span>最多人数</span>
                <input className="input" max={12} min={1} name="playerCountMax" type="number" defaultValue={candidate.playerCountMax ?? ""} />
              </label>
            </div>
            <div className="knowledge-form-actions">
              <ModalSubmitButton label="保存" pendingLabel="保存中" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CandidateRejectModal({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="candidate-reject-title">
        <div className="modal-head">
          <div>
            <div className="modal-title" id="candidate-reject-title">驳回候选知识</div>
            <div className="admin-card-sub">驳回后不可再批准；原因会记录在候选状态中，可选填。</div>
          </div>
          <button className="link-btn" type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          <form className="knowledge-form" action={rejectKnowledgeCandidate}>
            <input name="id" type="hidden" value={candidateId} />
            <label className="knowledge-field knowledge-field-full">
              <span>驳回原因（可选）</span>
              <textarea
                className="textarea"
                name="reviewerNote"
                placeholder="例如：内容过于具体，存在复刻原文风险"
                rows={4}
              />
            </label>
            <div className="knowledge-form-actions">
              <ModalSubmitButton danger label="确认驳回" pendingLabel="驳回中" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModalSubmitButton({ danger, label, pendingLabel }: { danger?: boolean; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button className={danger ? "admin-btn danger" : "admin-btn primary"} disabled={pending} type="submit">
      {pending ? `${pendingLabel}...` : label}
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  structure_rule: "结构规则",
  character_pattern: "角色模式",
  clue_pattern: "线索模式",
  timeline_pattern: "时间线模式",
  dm_flow_rule: "DM 流程",
  anti_novelization_rule: "反小说化",
  quality_metric: "质检标准",
  anti_pattern: "反例",
};

const STAGE_LABELS: Record<string, string> = {
  brief: "立项",
  case_core: "案件骨架",
  characters: "角色",
  clues: "线索",
  acts: "分幕",
  player_script: "玩家本",
  dm_manual: "DM 手册",
  review: "质检",
};

const MODULE_TYPE_LABELS: Record<string, string> = {
  case_core: "案件骨架",
  characters: "角色设定",
  clues: "线索卡",
  acts: "分幕结构",
  player_script: "玩家本",
  dm_manual: "DM 手册",
  truth_review: "真相复盘",
  quality_check: "质检规则",
};

const ABSTRACTION_LABELS: Record<string, string> = {
  summary: "摘要",
  pattern: "模式",
  rule: "规则",
  anti_pattern: "反例",
  quality_metric: "质检标准",
};

const RISK_LABELS: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};
