import "server-only";

import type {
  KnowledgeAbstractionLevel,
  KnowledgeCandidateReviewStatus,
  KnowledgeCategory,
  KnowledgeDocumentParseStatus,
  KnowledgeDocumentSourceType,
  KnowledgeExtractionStatus,
  KnowledgeModuleType,
  KnowledgeStage,
  QualityRiskLevel,
} from "@narrlight/shared";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type KnowledgeItemRow = {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  moduleType: KnowledgeModuleType;
  stage: KnowledgeStage;
  genre: string | null;
  playerCountMin: number | null;
  playerCountMax: number | null;
  difficulty: string | null;
  enabled: boolean;
  weight: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeUsageRow = {
  id: string;
  generationTaskId: string | null;
  scriptId: string | null;
  scriptTitle: string;
  creatorName: string;
  creatorEmail: string;
  taskType: string | null;
  knowledgeItemId: string;
  knowledgeTitle: string;
  stage: string;
  moduleType: string;
  usageReason: string;
  createdAt: string;
};

export type QualityReportRow = {
  id: string;
  generationTaskId: string | null;
  scriptId: string | null;
  scriptTitle: string;
  creatorName: string;
  creatorEmail: string;
  taskType: string | null;
  stage: string;
  moduleType: string;
  score: number;
  riskLevel: string;
  rewriteRequired: boolean;
  issues: unknown;
  createdAt: string;
};

export type KnowledgeDocumentRow = {
  id: string;
  title: string;
  sourceType: KnowledgeDocumentSourceType;
  storagePath: string | null;
  parsedText: string;
  parseStatus: KnowledgeDocumentParseStatus;
  parseError: string;
  charCount: number;
  promptCharLimit: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeExtractionJobRow = {
  id: string;
  documentId: string;
  documentTitle: string;
  status: KnowledgeExtractionStatus;
  parserVersion: string;
  extractorModel: string;
  errorMessage: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type KnowledgeCandidateRow = {
  id: string;
  documentId: string | null;
  documentTitle: string;
  extractionJobId: string | null;
  approvedKnowledgeItemId: string | null;
  title: string;
  content: string;
  category: KnowledgeCategory;
  moduleType: KnowledgeModuleType;
  stage: KnowledgeStage;
  genre: string | null;
  playerCountMin: number | null;
  playerCountMax: number | null;
  difficulty: string | null;
  abstractionLevel: KnowledgeAbstractionLevel;
  sourceContext: unknown;
  riskLevel: QualityRiskLevel;
  reviewStatus: KnowledgeCandidateReviewStatus;
  reviewerNote: string;
  weight: number;
  metadata: unknown;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeFilters = {
  q?: string;
  category?: string;
  stage?: string;
  enabled?: string;
};

type KnowledgeRecord = {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  module_type: KnowledgeModuleType;
  stage: KnowledgeStage;
  genre: string | null;
  player_count_min: number | null;
  player_count_max: number | null;
  difficulty: string | null;
  enabled: boolean;
  weight: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type UsageRecord = {
  id: string;
  generation_task_id: string | null;
  script_id: string | null;
  knowledge_item_id: string;
  stage: string;
  module_type: string;
  usage_reason: string;
  created_at: string;
  knowledge_items?: { title?: string | null } | null;
};

type QualityRecord = {
  id: string;
  generation_task_id: string | null;
  script_id: string | null;
  stage: string;
  module_type: string;
  score: number;
  risk_level: string;
  rewrite_required: boolean;
  issues: unknown;
  created_at: string;
};

type KnowledgeDocumentRecord = {
  id: string;
  title: string;
  source_type: KnowledgeDocumentSourceType;
  storage_path: string | null;
  parsed_text: string;
  parse_status: KnowledgeDocumentParseStatus;
  parse_error: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type KnowledgeExtractionJobRecord = {
  id: string;
  document_id: string;
  status: KnowledgeExtractionStatus;
  parser_version: string;
  extractor_model: string;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  knowledge_documents?: { title?: string | null } | null;
};

type KnowledgeCandidateRecord = {
  id: string;
  document_id: string | null;
  extraction_job_id: string | null;
  approved_knowledge_item_id: string | null;
  title: string;
  content: string;
  category: KnowledgeCategory;
  module_type: KnowledgeModuleType;
  stage: KnowledgeStage;
  genre: string | null;
  player_count_min: number | null;
  player_count_max: number | null;
  difficulty: string | null;
  abstraction_level: KnowledgeAbstractionLevel;
  source_context: unknown;
  risk_level: QualityRiskLevel;
  review_status: KnowledgeCandidateReviewStatus;
  reviewer_note: string;
  weight: number;
  metadata: unknown;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  knowledge_documents?: { title?: string | null } | null;
};

type ScriptContext = {
  id: string;
  title: string;
  author_id: string | null;
};

type UserContext = {
  id: string;
  email: string;
  nickname: string | null;
};

type TaskContext = {
  id: string;
  task_type: string | null;
};

export async function getKnowledgeItems(filters: KnowledgeFilters) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { items: [], error: "未配置 Supabase service role，无法读取知识库。" };

  let query = supabase
    .from("knowledge_items")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  const q = filters.q?.trim();
  if (q) query = query.or(`title.ilike.%${escapePostgrestValue(q)}%,content.ilike.%${escapePostgrestValue(q)}%`);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.stage && filters.stage !== "all") query = query.eq("stage", filters.stage);
  if (filters.enabled === "true") query = query.eq("enabled", true);
  if (filters.enabled === "false") query = query.eq("enabled", false);

  const { data, error } = await query.returns<KnowledgeRecord[]>();
  if (error) return { items: [], error: `读取知识库失败：${error.message}` };

  return { items: (data ?? []).map(mapKnowledgeItem), error: undefined };
}

export async function getKnowledgeItem(id: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("knowledge_items").select("*").eq("id", id).maybeSingle<KnowledgeRecord>();
  return data ? mapKnowledgeItem(data) : null;
}

export async function getKnowledgeUsageSnapshot() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { usages: [], reports: [], error: "未配置 Supabase service role，无法读取引用记录。" };

  const [usageResult, reportResult] = await Promise.all([
    supabase
      .from("generation_knowledge_usages")
      .select("id,generation_task_id,script_id,knowledge_item_id,stage,module_type,usage_reason,created_at,knowledge_items(title)")
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<UsageRecord[]>(),
    supabase
      .from("generation_quality_reports")
      .select("id,generation_task_id,script_id,stage,module_type,score,risk_level,rewrite_required,issues,created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<QualityRecord[]>(),
  ]);

  if (usageResult.error) return { usages: [], reports: [], error: `读取知识引用失败：${usageResult.error.message}` };
  if (reportResult.error) return { usages: [], reports: [], error: `读取质检报告失败：${reportResult.error.message}` };

  const usageRows = usageResult.data ?? [];
  const reportRows = reportResult.data ?? [];
  const scriptIds = uniqueStrings([...usageRows, ...reportRows].map((row) => row.script_id));
  const taskIds = uniqueStrings([...usageRows, ...reportRows].map((row) => row.generation_task_id));
  const scriptMap = await getScriptContextMap(scriptIds);
  const userMap = await getUserContextMap(uniqueStrings(Array.from(scriptMap.values()).map((script) => script.author_id)));
  const taskMap = await getTaskContextMap(taskIds);

  return {
    usages: usageRows.map((row) => {
      const script = row.script_id ? scriptMap.get(row.script_id) : undefined;
      const creator = script?.author_id ? userMap.get(script.author_id) : undefined;
      const task = row.generation_task_id ? taskMap.get(row.generation_task_id) : undefined;
      return {
        id: row.id,
        generationTaskId: row.generation_task_id,
        scriptId: row.script_id,
        scriptTitle: script?.title ?? "未知剧本",
        creatorName: creator?.nickname || creator?.email || "未知创作者",
        creatorEmail: creator?.email ?? "",
        taskType: task?.task_type ?? null,
        knowledgeItemId: row.knowledge_item_id,
        knowledgeTitle: row.knowledge_items?.title ?? row.knowledge_item_id.slice(0, 8),
        stage: row.stage,
        moduleType: row.module_type,
        usageReason: row.usage_reason,
        createdAt: row.created_at,
      };
    }),
    reports: reportRows.map((row) => {
      const script = row.script_id ? scriptMap.get(row.script_id) : undefined;
      const creator = script?.author_id ? userMap.get(script.author_id) : undefined;
      const task = row.generation_task_id ? taskMap.get(row.generation_task_id) : undefined;
      return {
        id: row.id,
        generationTaskId: row.generation_task_id,
        scriptId: row.script_id,
        scriptTitle: script?.title ?? "未知剧本",
        creatorName: creator?.nickname || creator?.email || "未知创作者",
        creatorEmail: creator?.email ?? "",
        taskType: task?.task_type ?? null,
        stage: row.stage,
        moduleType: row.module_type,
        score: row.score,
        riskLevel: row.risk_level,
        rewriteRequired: row.rewrite_required,
        issues: row.issues,
        createdAt: row.created_at,
      };
    }),
    error: undefined,
  };
}

export type KnowledgeIntakeFilters = {
  q?: string;
  reviewStatus?: string;
  category?: string;
};

export async function getKnowledgeIntakeSnapshot(filters?: KnowledgeIntakeFilters) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return {
      documents: [],
      jobs: [],
      candidates: [],
      error: "未配置 Supabase service role，无法读取二阶段资料抽取记录。",
    };
  }

  let candidateQuery = supabase
    .from("knowledge_candidates")
    .select("id,document_id,extraction_job_id,approved_knowledge_item_id,title,content,category,module_type,stage,genre,player_count_min,player_count_max,difficulty,abstraction_level,source_context,risk_level,review_status,reviewer_note,weight,metadata,reviewed_at,created_at,updated_at,knowledge_documents(title)")
    .order("updated_at", { ascending: false })
    .limit(50);

  const keyword = filters?.q?.trim();
  if (keyword) {
    const like = `%${keyword.replace(/[%_*]/g, "\\$&")}%`;
    candidateQuery = candidateQuery.or(`title.ilike.${like},content.ilike.${like}`);
  }
  if (filters?.reviewStatus && filters.reviewStatus !== "all") {
    candidateQuery = candidateQuery.eq("review_status", filters.reviewStatus);
  }
  if (filters?.category && filters.category !== "all") {
    candidateQuery = candidateQuery.eq("category", filters.category);
  }

  const [documentResult, jobResult, candidateResult] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<KnowledgeDocumentRecord[]>(),
    supabase
      .from("knowledge_extraction_jobs")
      .select("id,document_id,status,parser_version,extractor_model,error_message,started_at,completed_at,created_at,knowledge_documents(title)")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<KnowledgeExtractionJobRecord[]>(),
    candidateQuery.returns<KnowledgeCandidateRecord[]>(),
  ]);

  if (documentResult.error) {
    return {
      documents: [],
      jobs: [],
      candidates: [],
      error: `读取资料库失败：${documentResult.error.message}`,
    };
  }
  if (jobResult.error) {
    return {
      documents: [],
      jobs: [],
      candidates: [],
      error: `读取抽取任务失败：${jobResult.error.message}`,
    };
  }
  if (candidateResult.error) {
    return {
      documents: [],
      jobs: [],
      candidates: [],
      error: `读取候选知识失败：${candidateResult.error.message}`,
    };
  }

  return {
    documents: (documentResult.data ?? []).map(mapKnowledgeDocument),
    jobs: (jobResult.data ?? []).map(mapKnowledgeExtractionJob),
    candidates: (candidateResult.data ?? []).map(mapKnowledgeCandidate),
    error: undefined,
  };
}

async function getScriptContextMap(scriptIds: string[]) {
  const supabase = createAdminSupabaseClient();
  if (!supabase || scriptIds.length === 0) return new Map<string, ScriptContext>();
  const { data } = await supabase
    .from("scripts")
    .select("id,title,author_id")
    .in("id", scriptIds)
    .returns<ScriptContext[]>();
  return new Map((data ?? []).map((script) => [script.id, script]));
}

async function getUserContextMap(userIds: string[]) {
  const supabase = createAdminSupabaseClient();
  if (!supabase || userIds.length === 0) return new Map<string, UserContext>();
  const { data } = await supabase
    .from("users")
    .select("id,email,nickname")
    .in("id", userIds)
    .returns<UserContext[]>();
  return new Map((data ?? []).map((user) => [user.id, user]));
}

async function getTaskContextMap(taskIds: string[]) {
  const supabase = createAdminSupabaseClient();
  if (!supabase || taskIds.length === 0) return new Map<string, TaskContext>();
  const { data } = await supabase
    .from("generation_tasks")
    .select("id,task_type")
    .in("id", taskIds)
    .returns<TaskContext[]>();
  return new Map((data ?? []).map((task) => [task.id, task]));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function mapKnowledgeItem(row: KnowledgeRecord): KnowledgeItemRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    moduleType: row.module_type,
    stage: row.stage,
    genre: row.genre,
    playerCountMin: row.player_count_min,
    playerCountMax: row.player_count_max,
    difficulty: row.difficulty,
    enabled: row.enabled,
    weight: row.weight,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapKnowledgeDocument(row: KnowledgeDocumentRecord): KnowledgeDocumentRow {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    storagePath: row.storage_path,
    parsedText: row.parsed_text,
    parseStatus: row.parse_status,
    parseError: row.parse_error,
    charCount: typeof metadata.charCount === "number" ? metadata.charCount : 0,
    promptCharLimit: typeof metadata.promptCharLimit === "number" ? metadata.promptCharLimit : 0,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapKnowledgeExtractionJob(row: KnowledgeExtractionJobRecord): KnowledgeExtractionJobRow {
  return {
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.knowledge_documents?.title ?? "未知资料",
    status: row.status,
    parserVersion: row.parser_version,
    extractorModel: row.extractor_model,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapKnowledgeCandidate(row: KnowledgeCandidateRecord): KnowledgeCandidateRow {
  return {
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.knowledge_documents?.title ?? "未关联资料",
    extractionJobId: row.extraction_job_id,
    approvedKnowledgeItemId: row.approved_knowledge_item_id,
    title: row.title,
    content: row.content,
    category: row.category,
    moduleType: row.module_type,
    stage: row.stage,
    genre: row.genre,
    playerCountMin: row.player_count_min,
    playerCountMax: row.player_count_max,
    difficulty: row.difficulty,
    abstractionLevel: row.abstraction_level,
    sourceContext: row.source_context,
    riskLevel: row.risk_level,
    reviewStatus: row.review_status,
    reviewerNote: row.reviewer_note,
    weight: row.weight,
    metadata: row.metadata,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapePostgrestValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll(",", "\\,");
}
