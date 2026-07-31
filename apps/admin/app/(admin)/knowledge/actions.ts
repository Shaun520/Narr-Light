"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  KNOWLEDGE_ABSTRACTION_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  QUALITY_RISK_LEVELS,
} from "@narrlight/shared";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { extractKnowledgeCandidates, parseKnowledgeUpload } from "@/lib/services/knowledge-intake-extractor";
import { dedupeCandidates, type DedupeReference } from "@/lib/services/knowledge-intake-sanitize";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENRES = ["hardcore", "emotion", "horror", "funny", "mechanism"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export async function saveKnowledgeItem(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法保存知识条目。");

  const id = stringValue(formData.get("id"));
  const title = stringValue(formData.get("title"));
  const content = stringValue(formData.get("content"));
  const category = enumValue(formData.get("category"), KNOWLEDGE_CATEGORIES, "structure_rule");
  const moduleType = enumValue(formData.get("moduleType"), KNOWLEDGE_MODULE_TYPES, "case_core");
  const stage = enumValue(formData.get("stage"), KNOWLEDGE_STAGES, "case_core");
  const genre = optionalEnumValue(formData.get("genre"), GENRES);
  const difficulty = optionalEnumValue(formData.get("difficulty"), DIFFICULTIES);
  const playerCountMin = optionalNumber(formData.get("playerCountMin"));
  const playerCountMax = optionalNumber(formData.get("playerCountMax"));
  const weight = Math.max(0, Math.min(1000, optionalNumber(formData.get("weight")) ?? 100));
  const enabled = formData.get("enabled") === "on";

  if (!title || !content) throw new Error("标题和内容必填。");

  const payload = {
    title,
    content,
    category,
    module_type: moduleType,
    stage,
    genre,
    player_count_min: playerCountMin,
    player_count_max: playerCountMax,
    difficulty,
    enabled,
    weight,
    metadata: {},
    updated_at: new Date().toISOString(),
  };

  const result = id && UUID_PATTERN.test(id)
    ? await supabase.from("knowledge_items").update(payload).eq("id", id)
    : await supabase.from("knowledge_items").insert(payload);

  if (result.error) throw new Error(`保存知识条目失败：${result.error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?saved=1");
}

export async function toggleKnowledgeItem(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法更新知识条目。");

  const id = stringValue(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  if (!UUID_PATTERN.test(id)) redirect("/knowledge");

  const { error } = await supabase
    .from("knowledge_items")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`更新知识条目失败：${error.message}`);
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function deleteKnowledgeItem(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法删除知识条目。");

  const id = stringValue(formData.get("id"));
  if (!UUID_PATTERN.test(id)) redirect("/knowledge");

  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
  if (error) throw new Error(`删除知识条目失败：${error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function clearKnowledgeUsageRecords() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法清空引用和质检记录。");

  const [{ error: usageError }, { error: reportError }] = await Promise.all([
    supabase.from("generation_knowledge_usages").delete().neq("id", ZERO_UUID),
    supabase.from("generation_quality_reports").delete().neq("id", ZERO_UUID),
  ]);

  if (usageError) throw new Error(`清空知识引用记录失败：${usageError.message}`);
  if (reportError) throw new Error(`清空质检记录失败：${reportError.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?tab=usage&recordsCleared=1");
}

export async function uploadKnowledgeDocument(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法上传资料。");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("请选择要上传的 txt/md 资料。");

  const parsed = await parseKnowledgeUpload(file, stringValue(formData.get("title")));
  const now = new Date().toISOString();

  const { data: documentRow, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      title: parsed.title,
      source_type: parsed.sourceType,
      storage_path: null,
      parsed_text: parsed.parsedText,
      parse_status: "parsed",
      parse_error: "",
      metadata: parsed.metadata,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (documentError || !documentRow) {
    throw new Error(`保存资料记录失败：${documentError?.message ?? "missing document id"}`);
  }

  const { data: jobRow, error: jobError } = await supabase
    .from("knowledge_extraction_jobs")
    .insert({
      document_id: documentRow.id,
      status: "running",
      parser_version: "text-v1",
      extractor_model: "",
      result_json: {},
      error_message: "",
      started_at: now,
      created_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (jobError || !jobRow) {
    throw new Error(`创建抽取任务失败：${jobError?.message ?? "missing job id"}`);
  }

  const result = await runKnowledgeExtraction(supabase, {
    jobId: jobRow.id,
    documentId: documentRow.id,
    documentTitle: parsed.title,
    parsedText: parsed.parsedText,
  });

  revalidatePath("/knowledge");
  redirect(
    `/knowledge?tab=intake&documentExtracted=1&candidateCount=${result.candidateCount}${result.deduped > 0 ? `&deduped=${result.deduped}` : ""}`,
  );
}

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

// 抽取执行体：上传和失败重试共用。注意不能把 redirect 放进这里的 try/catch——
// redirect 通过抛出 NEXT_REDIRECT 工作，会被当成抽取失败把任务标记为 failed。
async function runKnowledgeExtraction(
  supabase: AdminSupabaseClient,
  input: {
    jobId: string;
    documentId: string;
    documentTitle: string;
    parsedText: string;
  },
): Promise<{ candidateCount: number; deduped: number }> {
  try {
    const extraction = await extractKnowledgeCandidates({
      documentId: input.documentId,
      documentTitle: input.documentTitle,
      parsedText: input.parsedText,
    });

    // 跨批去重：与已有知识条目和其他任务的待审候选比对，重复的直接跳过
    const references = await loadDedupeReferences(supabase, input.jobId);
    const { kept, dropped } = dedupeCandidates(extraction.candidates, references);

    const candidatePayload = kept.map((candidate) => ({
      ...candidate,
      document_id: input.documentId,
      extraction_job_id: input.jobId,
      review_status: "pending",
      reviewer_note: "",
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (candidatePayload.length > 0) {
      const { error: candidateError } = await supabase.from("knowledge_candidates").insert(candidatePayload);
      if (candidateError) throw new Error(`写入候选知识失败：${candidateError.message}`);
    }

    const { error: completeError } = await supabase
      .from("knowledge_extraction_jobs")
      .update({
        status: "completed",
        extractor_model: `${extraction.providerName}:${extraction.model}`,
        result_json: {
          providerName: extraction.providerName,
          model: extraction.model,
          candidateCount: candidatePayload.length,
          dedupedCount: dropped,
          rawResult: extraction.rawResult,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", input.jobId);
    if (completeError) throw new Error(`更新抽取任务失败：${completeError.message}`);

    return { candidateCount: candidatePayload.length, deduped: dropped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("knowledge_extraction_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", input.jobId);
    throw error;
  }
}

async function loadDedupeReferences(supabase: AdminSupabaseClient, currentJobId: string): Promise<DedupeReference[]> {
  const [itemsResult, candidatesResult] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select("title,content")
      .order("updated_at", { ascending: false })
      .limit(200)
      .returns<DedupeReference[]>(),
    supabase
      .from("knowledge_candidates")
      .select("title,content")
      .eq("review_status", "pending")
      .neq("extraction_job_id", currentJobId)
      .order("updated_at", { ascending: false })
      .limit(200)
      .returns<DedupeReference[]>(),
  ]);

  if (itemsResult.error) throw new Error(`读取已有知识条目失败：${itemsResult.error.message}`);
  if (candidatesResult.error) throw new Error(`读取待审候选失败：${candidatesResult.error.message}`);
  return [...(itemsResult.data ?? []), ...(candidatesResult.data ?? [])];
}

export async function retryKnowledgeExtraction(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法重试抽取任务。");

  if (!UUID_PATTERN.test(id)) redirect("/knowledge?tab=intake");

  const { data: job, error: jobError } = await supabase
    .from("knowledge_extraction_jobs")
    .select("id,status,document_id,knowledge_documents(id,title,parsed_text)")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      document_id: string;
      knowledge_documents: { id: string; title: string; parsed_text: string } | { id: string; title: string; parsed_text: string }[] | null;
    }>();

  if (jobError) throw new Error(`读取抽取任务失败：${jobError.message}`);
  if (!job || job.status !== "failed") redirect("/knowledge?tab=intake");

  const documentRow = Array.isArray(job.knowledge_documents) ? job.knowledge_documents[0] : job.knowledge_documents;
  if (!documentRow?.parsed_text) throw new Error("关联资料不存在或缺少解析文本，无法重试。");

  const { error: rerunError } = await supabase
    .from("knowledge_extraction_jobs")
    .update({
      status: "running",
      error_message: "",
      started_at: new Date().toISOString(),
      completed_at: null,
    })
    .eq("id", job.id);
  if (rerunError) throw new Error(`重置抽取任务状态失败：${rerunError.message}`);

  // 清理上次失败可能残留的待审候选，避免重试后重复入库
  await supabase
    .from("knowledge_candidates")
    .delete()
    .eq("extraction_job_id", job.id)
    .eq("review_status", "pending");

  const result = await runKnowledgeExtraction(supabase, {
    jobId: job.id,
    documentId: job.document_id,
    documentTitle: documentRow.title,
    parsedText: documentRow.parsed_text,
  });

  revalidatePath("/knowledge");
  redirect(
    `/knowledge?tab=intake&documentExtracted=1&candidateCount=${result.candidateCount}${result.deduped > 0 ? `&deduped=${result.deduped}` : ""}`,
  );
}

export async function deleteKnowledgeDocument(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法删除资料。");
  if (!UUID_PATTERN.test(id)) redirect("/knowledge?tab=intake");

  // 先清掉该资料下未审核的候选；已批准/已驳回的候选保留为审核记录
  const { error: candidateError } = await supabase
    .from("knowledge_candidates")
    .delete()
    .eq("document_id", id)
    .eq("review_status", "pending");
  if (candidateError) throw new Error(`删除资料待审候选失败：${candidateError.message}`);

  // 抽取任务随 document 级联删除；已入库的知识条目不受影响
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
  if (error) throw new Error(`删除资料失败：${error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?tab=intake&documentDeleted=1");
}

export async function approveKnowledgeCandidate(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法批准候选知识。");

  const id = stringValue(formData.get("id"));
  const enabled = formData.get("enabled") === "on";
  if (!UUID_PATTERN.test(id)) redirect("/knowledge");

  const { error } = await supabase.rpc("approve_knowledge_candidate", {
    p_candidate_id: id,
    p_enabled: enabled,
  });

  if (error) throw new Error(`批准候选知识失败：${error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?tab=intake&candidateApproved=1");
}

export async function updateKnowledgeCandidate(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法更新候选知识。");

  const id = stringValue(formData.get("id"));
  if (!UUID_PATTERN.test(id)) redirect("/knowledge?tab=intake");

  const title = stringValue(formData.get("title"));
  const content = stringValue(formData.get("content"));
  if (!title || !content) throw new Error("标题和内容必填。");

  const { error } = await supabase
    .from("knowledge_candidates")
    .update({
      title,
      content,
      category: enumValue(formData.get("category"), KNOWLEDGE_CATEGORIES, "structure_rule"),
      module_type: enumValue(formData.get("moduleType"), KNOWLEDGE_MODULE_TYPES, "case_core"),
      stage: enumValue(formData.get("stage"), KNOWLEDGE_STAGES, "case_core"),
      genre: optionalEnumValue(formData.get("genre"), GENRES),
      difficulty: optionalEnumValue(formData.get("difficulty"), DIFFICULTIES),
      player_count_min: optionalNumber(formData.get("playerCountMin")),
      player_count_max: optionalNumber(formData.get("playerCountMax")),
      abstraction_level: enumValue(formData.get("abstractionLevel"), KNOWLEDGE_ABSTRACTION_LEVELS, "pattern"),
      risk_level: enumValue(formData.get("riskLevel"), QUALITY_RISK_LEVELS, "medium"),
      weight: Math.max(0, Math.min(1000, optionalNumber(formData.get("weight")) ?? 100)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending");

  if (error) throw new Error(`更新候选知识失败：${error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?tab=intake&candidateSaved=1");
}

export async function rejectKnowledgeCandidate(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error("未配置 Supabase service role，无法驳回候选知识。");

  const id = stringValue(formData.get("id"));
  const reviewerNote = stringValue(formData.get("reviewerNote"));
  if (!UUID_PATTERN.test(id)) redirect("/knowledge");

  const { error } = await supabase
    .from("knowledge_candidates")
    .update({
      review_status: "rejected",
      reviewer_note: reviewerNote,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending");

  if (error) throw new Error(`驳回候选知识失败：${error.message}`);

  revalidatePath("/knowledge");
  redirect("/knowledge?tab=intake&candidateRejected=1");
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function enumValue<T extends readonly string[]>(
  value: FormDataEntryValue | null,
  options: T,
  fallback: T[number],
): T[number] {
  const raw = stringValue(value);
  return options.includes(raw) ? raw as T[number] : fallback;
}

function optionalEnumValue<T extends readonly string[]>(value: FormDataEntryValue | null, options: T): T[number] | null {
  const raw = stringValue(value);
  return raw && options.includes(raw) ? raw as T[number] : null;
}
