import Link from "next/link";
import { FileSearch } from "lucide-react";
import { AdminFilterForm } from "@/components/admin-filter-form";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  type KnowledgeCategory,
  type KnowledgeStage,
} from "@narrlight/shared";
import { PageHeader, Tag } from "@/components/admin-static";
import { KnowledgeTabs, type KnowledgeTab } from "@/components/knowledge-tabs";
import { getKnowledgeIntakeSnapshot, getKnowledgeItem, getKnowledgeItems, getKnowledgeUsageSnapshot } from "@/lib/services/knowledge";
import {
  approveKnowledgeCandidate,
  deleteKnowledgeItem,
  saveKnowledgeItem,
  toggleKnowledgeItem,
} from "./actions";
import { AdminClearKnowledgeRecordsButton } from "@/components/admin-clear-knowledge-records-button";
import { AdminDeleteKnowledgeDocumentButton } from "@/components/admin-delete-knowledge-document-button";
import { AdminRetryKnowledgeJobButton } from "@/components/admin-retry-knowledge-job-button";
import { AdminToast } from "@/components/admin-toast";
import { CandidateReviewActions } from "@/components/knowledge-candidate-review-actions";
import { KnowledgeUploadForm } from "@/components/knowledge-upload-form";

type SearchParams = {
  tab?: string;
  q?: string;
  category?: string;
  stage?: string;
  enabled?: string;
  itemId?: string;
  mode?: string;
  saved?: string;
  recordsCleared?: string;
  candidateApproved?: string;
  candidateRejected?: string;
  candidateSaved?: string;
  documentExtracted?: string;
  candidateCount?: string;
  deduped?: string;
  documentDeleted?: string;
};

const GENRES = ["hardcore", "emotion", "horror", "funny", "mechanism"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [{ items, error }, selectedItem, usageSnapshot, intakeSnapshot] = await Promise.all([
    getKnowledgeItems(params),
    params.itemId ? getKnowledgeItem(params.itemId) : Promise.resolve(null),
    getKnowledgeUsageSnapshot(),
    getKnowledgeIntakeSnapshot(),
  ]);
  const modalOpen = params.mode === "new" || Boolean(selectedItem);
  const hasUsageRecords = usageSnapshot.usages.length > 0 || usageSnapshot.reports.length > 0;
  const pendingCandidates = intakeSnapshot.candidates.filter((candidate) => candidate.reviewStatus === "pending");
  const visibleJobs = [
    ...intakeSnapshot.jobs.filter((job) => job.status === "failed"),
    ...intakeSnapshot.jobs.filter((job) => job.status !== "failed"),
  ]
    .filter((job, index, list) => list.findIndex((item) => item.id === job.id) === index)
    .slice(0, 5);
  const activeTab: KnowledgeTab = params.tab === "intake" || params.tab === "usage" ? params.tab : "items";

  return (
    <div className="page-stack">
      <PageHeader
        title="创作知识库"
        description="管理规则、模式、反例和质检标准，供生成阶段按需引用。"
      />

      {params.saved === "1" && <AdminToast clearParams={["saved"]} message="知识条目已保存" />}
      {params.recordsCleared === "1" && <AdminToast clearParams={["recordsCleared"]} message="引用和质检记录已清空" />}
      {params.candidateApproved === "1" && <AdminToast clearParams={["candidateApproved"]} message="候选知识已批准入库" />}
      {params.candidateRejected === "1" && <AdminToast clearParams={["candidateRejected"]} message="候选知识已驳回" />}
      {params.candidateSaved === "1" && <AdminToast clearParams={["candidateSaved"]} message="候选知识已保存" />}
      {params.documentExtracted === "1" && (
        <AdminToast
          clearParams={["documentExtracted", "candidateCount", "deduped"]}
          message={`资料已解析，生成 ${params.candidateCount ?? 0} 条候选知识${Number(params.deduped) > 0 ? `，已跳过 ${params.deduped} 条重复候选` : ""}`}
        />
      )}
      {params.documentDeleted === "1" && <AdminToast clearParams={["documentDeleted"]} message="资料及其待审候选已删除" />}
      {error && <div className="admin-inline-alert" role="alert">{error}</div>}
      {usageSnapshot.error && <div className="admin-inline-alert" role="alert">{usageSnapshot.error}</div>}
      {intakeSnapshot.error && <div className="admin-inline-alert" role="alert">{intakeSnapshot.error}</div>}

      <KnowledgeTabs
        key={activeTab}
        initialTab={activeTab}
        items={
          <section key="items" className="admin-card">
        <AdminFilterForm action="/knowledge">
          <div className="toolbar-left">
            <input className="input input-wide" name="q" placeholder="搜索标题或内容" defaultValue={params.q ?? ""} />
            <select className="select" name="category" defaultValue={params.category ?? "all"}>
              <option value="all">全部类型</option>
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{categoryLabel(category)}</option>
              ))}
            </select>
            <select className="select" name="stage" defaultValue={params.stage ?? "all"}>
              <option value="all">全部阶段</option>
              {KNOWLEDGE_STAGES.map((stage) => (
                <option key={stage} value={stage}>{stageLabel(stage)}</option>
              ))}
            </select>
            <select className="select" name="enabled" defaultValue={params.enabled ?? "all"}>
              <option value="all">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已停用</option>
            </select>
            <button className="admin-btn primary" type="submit">查询</button>
            <Link className="admin-btn" href="/knowledge">重置</Link>
          </div>
          <div className="toolbar-right">
            <Link className="admin-btn primary" href={buildNewHref(params)}>新增</Link>
          </div>
        </AdminFilterForm>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>知识</th>
                <th>类型</th>
                <th>阶段</th>
                <th>题材</th>
                <th>权重</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className={item.id === selectedItem?.id ? "table-row-selected" : ""} key={item.id}>
                  <td>
                    <b>{item.title}</b>
                    <div className="placeholder-meta">{item.content.slice(0, 60)}</div>
                  </td>
                  <td>{categoryLabel(item.category)}</td>
                  <td>{stageLabel(item.stage)}</td>
                  <td>{item.genre ?? "通用"}</td>
                  <td>{item.weight}</td>
                  <td>{item.enabled ? <Tag tone="success">启用</Tag> : <Tag>停用</Tag>}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="link-btn" href={buildItemHref(params, item.id)}>编辑</Link>
                      <form action={toggleKnowledgeItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="enabled" value={item.enabled ? "false" : "true"} />
                        <button className="link-btn" type="submit">{item.enabled ? "停用" : "启用"}</button>
                      </form>
                      <form action={deleteKnowledgeItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="link-btn danger" type="submit">删除</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={7}>暂无知识条目</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </section>
        }
        intake={
          <section key="intake" className="admin-card">
        <div className="admin-card-head knowledge-usage-head knowledge-intake-head">
          <div>
            <div className="admin-card-title">二阶段资料抽取</div>
            <div className="admin-card-sub">资料解析和候选知识默认不进入生成链路，需人工批准后才写入正式知识库。</div>
          </div>
          <div className="knowledge-intake-summary">
            <span>资料 {intakeSnapshot.documents.length}</span>
            <span>任务 {intakeSnapshot.jobs.length}</span>
            <span>待审 {pendingCandidates.length}</span>
          </div>
        </div>
        <div className="knowledge-upload-panel">
          <KnowledgeUploadForm />
          <div className="admin-card-sub">当前支持 txt/md；PDF/DOCX 先转纯文本，避免未清洗原文污染知识库。</div>
        </div>
        {(intakeSnapshot.documents.length > 0 || intakeSnapshot.jobs.length > 0) && (
          <div className="knowledge-intake-meta">
            {intakeSnapshot.documents.slice(0, 3).map((document) => (
              <span className="knowledge-job" key={document.id}>
                资料：{document.title} / {parseStatusLabel(document.parseStatus)}
                {document.promptCharLimit > 0 && document.charCount > document.promptCharLimit && (
                  <span
                    className="knowledge-doc-warn"
                    title={`原文共 ${document.charCount.toLocaleString("zh-CN")} 字，超出单次抽取上限，仅前 ${document.promptCharLimit.toLocaleString("zh-CN")} 字参与抽取`}
                  >
                    截断 { (document.charCount - document.promptCharLimit).toLocaleString("zh-CN") } 字
                  </span>
                )}
                <AdminDeleteKnowledgeDocumentButton documentId={document.id} title={document.title} />
              </span>
            ))}
            {visibleJobs.map((job) => (
              <span className="knowledge-job" key={job.id}>
                任务：{job.documentTitle} / {jobStatusLabel(job.status)}
                {job.status === "failed" && (
                  <>
                    {job.errorMessage && (
                      <span className="knowledge-job-error" title={job.errorMessage}>{job.errorMessage}</span>
                    )}
                    <AdminRetryKnowledgeJobButton jobId={job.id} />
                  </>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="table-wrap knowledge-candidate-wrap">
          <table className="table knowledge-candidate-table">
            <thead>
              <tr>
                <th>候选知识</th>
                <th>来源</th>
                <th>类型 / 阶段</th>
                <th>抽象层级</th>
                <th>风险</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {intakeSnapshot.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <b>{candidate.title}</b>
                    <div className="placeholder-meta">{candidate.content.slice(0, 72)}</div>
                  </td>
                  <td>
                    {candidate.documentTitle}
                    <div className="placeholder-meta">{formatDateTime(candidate.createdAt)}</div>
                  </td>
                  <td>
                    {categoryLabel(candidate.category)}
                    <div className="placeholder-meta">{stageLabel(candidate.stage)} / {moduleTypeLabel(candidate.moduleType)}</div>
                  </td>
                  <td>{abstractionLevelLabel(candidate.abstractionLevel)}</td>
                  <td>{riskTag(candidate.riskLevel)}</td>
                  <td>{candidateStatusTag(candidate.reviewStatus)}</td>
                  <td>
                    {candidate.reviewStatus === "pending" ? (
                      <div className="row-actions">
                        <form action={approveKnowledgeCandidate}>
                          <input type="hidden" name="id" value={candidate.id} />
                          <button className="link-btn" type="submit">批准入库</button>
                        </form>
                        <form action={approveKnowledgeCandidate}>
                          <input type="hidden" name="id" value={candidate.id} />
                          <input type="hidden" name="enabled" value="on" />
                          <button className="link-btn" type="submit">批准并启用</button>
                        </form>
                        <CandidateReviewActions
                          candidate={{
                            id: candidate.id,
                            title: candidate.title,
                            content: candidate.content,
                            category: candidate.category,
                            moduleType: candidate.moduleType,
                            stage: candidate.stage,
                            genre: candidate.genre,
                            playerCountMin: candidate.playerCountMin,
                            playerCountMax: candidate.playerCountMax,
                            difficulty: candidate.difficulty,
                            abstractionLevel: candidate.abstractionLevel,
                            riskLevel: candidate.riskLevel,
                            weight: candidate.weight,
                          }}
                        />
                      </div>
                    ) : candidate.approvedKnowledgeItemId ? (
                      <Link className="link-btn" href={buildItemHref(params, candidate.approvedKnowledgeItemId)}>查看知识</Link>
                    ) : (
                      <span className="placeholder-meta">{candidate.reviewerNote || "已处理"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {intakeSnapshot.candidates.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    <div className="knowledge-empty">
                      <FileSearch size={28} strokeWidth={1.5} />
                      <div className="knowledge-empty-title">暂无候选知识</div>
                      <div className="knowledge-empty-sub">上传资料并抽取后，候选知识会在这里等待审核</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </section>
        }
        usage={
          <section key="usage" className="admin-card">
        <div className="admin-card-head knowledge-usage-head">
          <div>
            <div className="admin-card-title">最近引用和质检</div>
            <div className="admin-card-sub">确认生成阶段实际使用了哪些规则。</div>
          </div>
          <AdminClearKnowledgeRecordsButton disabled={!hasUsageRecords} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>类型</th>
                <th>创作者</th>
                <th>剧本</th>
                <th>任务</th>
                <th>阶段</th>
                <th>模块</th>
                <th>内容 / 质检</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {usageSnapshot.usages.map((usage) => (
                <tr key={`usage-${usage.id}`}>
                  <td><Tag tone="info">引用</Tag></td>
                  <td>
                    <b>{usage.creatorName}</b>
                    {usage.creatorEmail && <div className="placeholder-meta">{usage.creatorEmail}</div>}
                  </td>
                  <td>{usage.scriptId ? <Link className="link-btn" href={`/scripts?scriptId=${usage.scriptId}`}>{usage.scriptTitle}</Link> : usage.scriptTitle}</td>
                  <td>{usage.generationTaskId ? <Link className="link-btn" href={`/tasks/generation?taskId=${usage.generationTaskId}`}>{usage.taskType ?? "生成任务"}</Link> : "未记录"}</td>
                  <td>{stageLabel(usage.stage)}</td>
                  <td>{moduleTypeLabel(usage.moduleType)}</td>
                  <td>{usage.knowledgeTitle} / {usage.usageReason || "阶段规则引用"}</td>
                  <td>{formatDateTime(usage.createdAt)}</td>
                </tr>
              ))}
              {usageSnapshot.reports.map((report) => (
                <tr key={`report-${report.id}`}>
                  <td><Tag tone={report.rewriteRequired ? "warning" : "success"}>质检</Tag></td>
                  <td>
                    <b>{report.creatorName}</b>
                    {report.creatorEmail && <div className="placeholder-meta">{report.creatorEmail}</div>}
                  </td>
                  <td>{report.scriptId ? <Link className="link-btn" href={`/scripts?scriptId=${report.scriptId}`}>{report.scriptTitle}</Link> : report.scriptTitle}</td>
                  <td>{report.generationTaskId ? <Link className="link-btn" href={`/tasks/generation?taskId=${report.generationTaskId}`}>{report.taskType ?? "生成任务"}</Link> : "未记录"}</td>
                  <td>{stageLabel(report.stage)}</td>
                  <td>{moduleTypeLabel(report.moduleType)}</td>
                  <td>
                    <div className="quality-summary">
                      {riskTag(report.riskLevel)}
                      <span>分数 {report.score}</span>
                      <span>{report.rewriteRequired ? "建议重写" : "无需重写"}</span>
                    </div>
                    <div className="placeholder-meta">{issueSummary(report.issues)}</div>
                  </td>
                  <td>{formatDateTime(report.createdAt)}</td>
                </tr>
              ))}
              {!hasUsageRecords && (
                <tr>
                  <td className="table-empty" colSpan={8}>暂无引用或质检记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </section>
        }
      />

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="knowledge-form-title">
            <div className="modal-head">
              <div>
                <div className="modal-title" id="knowledge-form-title">
                  {selectedItem ? "编辑知识条目" : "新增知识条目"}
                </div>
                <div className="admin-card-sub">一期优先录入高质量规则，不录入完整剧本文本。</div>
              </div>
              <Link className="link-btn" href={buildCloseHref(params)}>关闭</Link>
            </div>
            <div className="modal-body">
              <KnowledgeForm item={selectedItem} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeForm({ item }: { item: Awaited<ReturnType<typeof getKnowledgeItem>> }) {
  return (
    <form className="knowledge-form" action={saveKnowledgeItem}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="knowledge-field knowledge-field-full">
        <span>标题</span>
        <input className="input" name="title" required placeholder="例如：角色本信息释放规则" defaultValue={item?.title ?? ""} />
      </label>
      <label className="knowledge-field knowledge-field-full">
        <span>内容</span>
        <textarea
          className="textarea knowledge-content-input"
          name="content"
          required
          placeholder="只录入规则、模式、反例或质检标准，不录入完整剧本文本。"
          defaultValue={item?.content ?? ""}
        />
      </label>
      <div className="knowledge-grid-3">
        <label className="knowledge-field">
          <span>类型</span>
          <select className="select" name="category" defaultValue={item?.category ?? "structure_rule"}>
            {KNOWLEDGE_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
        </label>
        <label className="knowledge-field">
          <span>阶段</span>
          <select className="select" name="stage" defaultValue={item?.stage ?? "case_core"}>
            {KNOWLEDGE_STAGES.map((stage) => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
          </select>
        </label>
        <label className="knowledge-field">
          <span>模块</span>
          <select className="select" name="moduleType" defaultValue={item?.moduleType ?? "case_core"}>
            {KNOWLEDGE_MODULE_TYPES.map((moduleType) => (
              <option key={moduleType} value={moduleType}>{moduleTypeLabel(moduleType)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="knowledge-grid-2">
        <label className="knowledge-field"><span>题材</span><select className="select" name="genre" defaultValue={item?.genre ?? ""}><option value="">通用</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></label>
        <label className="knowledge-field"><span>难度</span><select className="select" name="difficulty" defaultValue={item?.difficulty ?? ""}><option value="">通用</option>{DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}</select></label>
      </div>
      <div className="knowledge-grid-3">
        <label className="knowledge-field"><span>最少人数</span><input className="input" min={1} max={12} name="playerCountMin" type="number" defaultValue={item?.playerCountMin ?? ""} /></label>
        <label className="knowledge-field"><span>最多人数</span><input className="input" min={1} max={12} name="playerCountMax" type="number" defaultValue={item?.playerCountMax ?? ""} /></label>
        <label className="knowledge-field"><span>权重</span><input className="input" min={0} max={1000} name="weight" type="number" defaultValue={item?.weight ?? 100} /></label>
      </div>
      <div className="knowledge-form-actions">
        <label className="checkbox-row"><input name="enabled" type="checkbox" defaultChecked={item?.enabled ?? true} /><span>启用</span></label>
        <button className="admin-btn primary" type="submit">保存</button>
      </div>
    </form>
  );
}

function buildNewHref(params: SearchParams) {
  const next = buildListParams(params);
  next.set("mode", "new");
  return `/knowledge?${next.toString()}`;
}

function buildItemHref(params: SearchParams, itemId: string) {
  const next = buildListParams(params);
  next.set("itemId", itemId);
  return `/knowledge?${next.toString()}`;
}

function buildCloseHref(params: SearchParams) {
  const next = buildListParams(params);
  const query = next.toString();
  return query ? `/knowledge?${query}` : "/knowledge";
}

function buildListParams(params: SearchParams) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.category) next.set("category", params.category);
  if (params.stage) next.set("stage", params.stage);
  if (params.enabled) next.set("enabled", params.enabled);
  return next;
}

function categoryLabel(category: KnowledgeCategory | string) {
  const labels: Record<string, string> = {
    structure_rule: "结构规则",
    character_pattern: "角色模式",
    clue_pattern: "线索模式",
    timeline_pattern: "时间线模式",
    dm_flow_rule: "DM 流程",
    anti_novelization_rule: "反小说化",
    quality_metric: "质检标准",
    anti_pattern: "反例",
  };
  return labels[category] ?? category;
}

function stageLabel(stage: KnowledgeStage | string) {
  const labels: Record<string, string> = {
    brief: "立项",
    case_core: "案件骨架",
    characters: "角色",
    clues: "线索",
    acts: "分幕",
    player_script: "玩家本",
    dm_manual: "DM 手册",
    review: "质检",
  };
  return labels[stage] ?? stage;
}

function moduleTypeLabel(moduleType: string) {
  const labels: Record<string, string> = {
    case_core: "案件骨架",
    characters: "角色设定",
    clues: "线索卡",
    acts: "分幕结构",
    player_script: "玩家本",
    dm_manual: "DM 手册",
    truth_review: "真相复盘",
    quality_check: "质检规则",
  };
  return labels[moduleType] ?? moduleType;
}

function riskTag(riskLevel: string) {
  const labels: Record<string, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  const tone = riskLevel === "high" ? "error" : riskLevel === "medium" ? "warning" : "success";
  return <Tag tone={tone}>{labels[riskLevel] ?? riskLevel}</Tag>;
}

function candidateStatusTag(status: string) {
  if (status === "approved") return <Tag tone="success">已入库</Tag>;
  if (status === "rejected") return <Tag tone="error">已驳回</Tag>;
  return <Tag tone="warning">待审核</Tag>;
}

function abstractionLevelLabel(level: string) {
  const labels: Record<string, string> = {
    summary: "摘要",
    pattern: "模式",
    rule: "规则",
    anti_pattern: "反例",
    quality_metric: "质检标准",
  };
  return labels[level] ?? level;
}

function parseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "待解析",
    parsed: "已解析",
    failed: "解析失败",
    needs_cleanup: "需清洗",
  };
  return labels[status] ?? status;
}

function jobStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "等待中",
    running: "抽取中",
    completed: "已完成",
    failed: "失败",
  };
  return labels[status] ?? status;
}

function issueSummary(issues: unknown) {
  if (!Array.isArray(issues) || issues.length === 0) return "未发现明显小说化问题";
  return issues
    .map((issue) => {
      if (!issue || typeof issue !== "object") return "";
      const message = "message" in issue ? issue.message : "";
      return typeof message === "string" ? message : "";
    })
    .filter(Boolean)
    .join("；") || "存在风险项，请查看原始质检数据";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
