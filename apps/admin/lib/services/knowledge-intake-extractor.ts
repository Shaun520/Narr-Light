import "server-only";

import {
  KNOWLEDGE_ABSTRACTION_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  QUALITY_RISK_LEVELS,
  type KnowledgeAbstractionLevel,
  type KnowledgeCategory,
  type KnowledgeDocumentSourceType,
  type KnowledgeModuleType,
  type KnowledgeStage,
  type ProviderRuntimeConfig,
  type QualityRiskLevel,
  type TextProviderName,
} from "@narrlight/shared";
import { getSystemConfigSnapshot } from "@/lib/services/system-config";

const MAX_FILE_BYTES = 1_500_000;
const MAX_PROMPT_CHARS = 28_000;
const MAX_CANDIDATES = 12;

const TEXT_PROVIDER_ENV_KEYS: Record<TextProviderName, string[]> = {
  deepseek: ["DEEPSEEK_API_KEY"],
  glm: ["GLM_API_KEY"],
  kimi: ["KIMI_API_KEY", "KSPMAS_API_KEY", "MOONSHOT_API_KEY"],
};

type ParsedKnowledgeUpload = {
  title: string;
  sourceType: KnowledgeDocumentSourceType;
  parsedText: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    charCount: number;
    promptCharLimit: number;
  };
};

export type KnowledgeCandidateInsert = {
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
  source_context: Record<string, unknown>;
  risk_level: QualityRiskLevel;
  weight: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeExtractionOutput = {
  providerName: TextProviderName;
  model: string;
  rawResult: unknown;
  candidates: KnowledgeCandidateInsert[];
};

type ModelCandidate = {
  title?: unknown;
  content?: unknown;
  category?: unknown;
  moduleType?: unknown;
  module_type?: unknown;
  stage?: unknown;
  genre?: unknown;
  playerCountMin?: unknown;
  player_count_min?: unknown;
  playerCountMax?: unknown;
  player_count_max?: unknown;
  difficulty?: unknown;
  abstractionLevel?: unknown;
  abstraction_level?: unknown;
  sourceContext?: unknown;
  source_context?: unknown;
  riskLevel?: unknown;
  risk_level?: unknown;
  weight?: unknown;
};

type ExtractionResponse = {
  documentSummary?: unknown;
  candidates?: unknown;
};

type ChatResponse = {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string };
  }>;
};

export async function parseKnowledgeUpload(file: File, titleOverride?: string): Promise<ParsedKnowledgeUpload> {
  const fileName = file.name || "未命名资料";
  if (file.size <= 0) throw new Error("上传资料为空。");
  if (file.size > MAX_FILE_BYTES) throw new Error("上传资料过大，请先清洗为 1.5MB 以内的 txt/md 文本。");

  const sourceType = getSourceType(fileName, file.type);
  if (sourceType !== "txt" && sourceType !== "md") {
    throw new Error("当前抽取器先支持 txt/md 文本资料；PDF/DOCX 请先转成纯文本后上传。");
  }

  const parsedText = new TextDecoder("utf-8", { fatal: false })
    .decode(await file.arrayBuffer())
    .replace(/\u0000/g, "")
    .trim();
  if (parsedText.length < 200) throw new Error("资料文本过短，无法稳定抽取可复用知识。");

  return {
    title: titleOverride?.trim() || stripExtension(fileName),
    sourceType,
    parsedText,
    metadata: {
      fileName,
      fileType: file.type || "text/plain",
      fileSize: file.size,
      charCount: parsedText.length,
      promptCharLimit: MAX_PROMPT_CHARS,
    },
  };
}

export async function extractKnowledgeCandidates(input: {
  documentId: string;
  documentTitle: string;
  parsedText: string;
}): Promise<KnowledgeExtractionOutput> {
  const { name, runtime, apiKey, baseUrl } = await resolveTextProvider();
  const prompt = buildExtractionPrompt(input.documentTitle, input.parsedText.slice(0, MAX_PROMPT_CHARS));
  const text = await callChatCompletion({
    providerName: name,
    apiKey,
    baseUrl,
    runtime,
    prompt,
  });
  const rawResult = parseJSONWithTolerance<ExtractionResponse>(text);
  const candidates = sanitizeCandidates(rawResult, input.documentId, name, runtime.model);
  if (candidates.length === 0) {
    throw new Error("模型未返回可审核的候选知识，请调整资料文本后重试。");
  }
  return {
    providerName: name,
    model: runtime.model,
    rawResult,
    candidates,
  };
}

async function resolveTextProvider() {
  const { textProvider } = await getSystemConfigSnapshot();
  const names: TextProviderName[] = [textProvider.primary];
  if (textProvider.fallback && textProvider.fallback !== textProvider.primary) {
    names.push(textProvider.fallback);
  }

  for (const name of names) {
    const runtime = textProvider.providers[name];
    const apiKey = getProviderApiKey(name);
    if (runtime?.enabled && apiKey) {
      return {
        name,
        runtime,
        apiKey,
        baseUrl: getProviderBaseUrl(name),
      };
    }
  }

  throw new Error("未找到可用的文本模型 API Key，请先配置 DEEPSEEK_API_KEY、GLM_API_KEY 或 KIMI_API_KEY。");
}

async function callChatCompletion(input: {
  providerName: TextProviderName;
  apiKey: string;
  baseUrl: string;
  runtime: ProviderRuntimeConfig;
  prompt: string;
}) {
  const maxAttempts = Math.max(1, (input.runtime.retries ?? 0) + 1);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(60, input.runtime.timeout ?? 180) * 1000);
    try {
      const response = await fetch(`${input.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.runtime.model,
          messages: [
            {
              role: "system",
              content:
                "你是剧本杀创作知识库抽取专家。你只抽象可复用规则、模式、反例和质检标准，不复刻原文、台词、桥段、人物设定或作案手法。",
            },
            { role: "user", content: input.prompt },
          ],
          temperature: input.runtime.temperature ?? 0.2,
          max_tokens: 4096,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw await wrapProviderError(input.providerName, response);
      const data = (await response.json()) as ChatResponse;
      return data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || "";
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) await delay(500 * attempt);
    }
  }

  throw lastError ?? new Error("候选知识抽取失败。");
}

function buildExtractionPrompt(documentTitle: string, text: string) {
  return `请从以下剧本杀资料中抽取“可复用创作知识候选”，用于 NarrLight 知识库人工审核。

资料标题：${documentTitle}

抽取要求：
1. 只抽象规则、设计模式、反例、质检标准；不要复制原文句子、台词、角色名、地点名、具体桥段或作案手法。
2. 每条候选必须能服务某个生成阶段：brief / case_core / characters / clues / acts / player_script / dm_manual / review。
3. 优先提炼结构、信息差、线索闭环、玩家目标、DM 流程、反小说化规则。
4. 高版权/复刻风险内容标记 riskLevel=high，通常应该作为 anti_pattern，而不是可直接启用规则。
5. 返回 JSON，不要 markdown，不要额外解释。

可用枚举：
category=${KNOWLEDGE_CATEGORIES.join(" | ")}
stage=${KNOWLEDGE_STAGES.join(" | ")}
moduleType=${KNOWLEDGE_MODULE_TYPES.join(" | ")}
abstractionLevel=${KNOWLEDGE_ABSTRACTION_LEVELS.join(" | ")}
riskLevel=${QUALITY_RISK_LEVELS.join(" | ")}

返回结构：
{
  "documentSummary": "不超过 120 字的资料结构摘要",
  "candidates": [
    {
      "title": "候选知识标题",
      "content": "抽象后的规则/模式/反例/质检标准，80-300 字，不包含原文",
      "category": "structure_rule",
      "moduleType": "case_core",
      "stage": "case_core",
      "genre": null,
      "playerCountMin": null,
      "playerCountMax": null,
      "difficulty": null,
      "abstractionLevel": "rule",
      "riskLevel": "medium",
      "weight": 100,
      "sourceContext": {
        "basis": "说明该候选来自资料中的哪类结构观察，不要贴原文",
        "copyRisk": "low | medium | high"
      }
    }
  ]
}

资料正文：
${text}`;
}

function sanitizeCandidates(
  rawResult: ExtractionResponse,
  documentId: string,
  providerName: TextProviderName,
  model: string,
): KnowledgeCandidateInsert[] {
  const rows = Array.isArray(rawResult.candidates) ? rawResult.candidates : [];
  return rows
    .map((row) => sanitizeCandidate(row as ModelCandidate, rawResult, documentId, providerName, model))
    .filter((row): row is KnowledgeCandidateInsert => Boolean(row))
    .slice(0, MAX_CANDIDATES);
}

function sanitizeCandidate(
  row: ModelCandidate,
  rawResult: ExtractionResponse,
  documentId: string,
  providerName: TextProviderName,
  model: string,
): KnowledgeCandidateInsert | null {
  const title = stringValue(row.title).slice(0, 120);
  const content = stringValue(row.content).slice(0, 1_200);
  if (!title || content.length < 30) return null;

  const category = enumValue(row.category, KNOWLEDGE_CATEGORIES, "structure_rule");
  const moduleType = enumValue(row.moduleType ?? row.module_type, KNOWLEDGE_MODULE_TYPES, "case_core");
  const stage = enumValue(row.stage, KNOWLEDGE_STAGES, "case_core");
  const abstractionLevel = enumValue(
    row.abstractionLevel ?? row.abstraction_level,
    KNOWLEDGE_ABSTRACTION_LEVELS,
    category === "quality_metric" ? "quality_metric" : category === "anti_pattern" ? "anti_pattern" : "pattern",
  );
  const riskLevel = enumValue(row.riskLevel ?? row.risk_level, QUALITY_RISK_LEVELS, "medium");

  return {
    title,
    content,
    category,
    module_type: moduleType,
    stage,
    genre: optionalEnum(row.genre, ["hardcore", "emotion", "horror", "funny", "mechanism"] as const),
    player_count_min: optionalBoundedNumber(row.playerCountMin ?? row.player_count_min, 1, 12),
    player_count_max: optionalBoundedNumber(row.playerCountMax ?? row.player_count_max, 1, 12),
    difficulty: optionalEnum(row.difficulty, ["beginner", "intermediate", "advanced", "expert"] as const),
    abstraction_level: abstractionLevel,
    source_context: {
      ...(isRecord(row.sourceContext) ? row.sourceContext : {}),
      ...(isRecord(row.source_context) ? row.source_context : {}),
      documentId,
      documentSummary: stringValue(rawResult.documentSummary).slice(0, 240),
    },
    risk_level: riskLevel,
    weight: optionalBoundedNumber(row.weight, 0, 1000) ?? 100,
    metadata: {
      source: "knowledge_phase_two_extraction",
      extractorProvider: providerName,
      extractorModel: model,
    },
  };
}

function getSourceType(fileName: string, mimeType: string): KnowledgeDocumentSourceType {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "md" || mimeType.includes("markdown")) return "md";
  if (extension === "txt" || mimeType.startsWith("text/")) return "txt";
  if (extension === "docx") return "docx";
  if (extension === "pdf") return "pdf";
  return "manual";
}

function getProviderApiKey(name: TextProviderName) {
  return TEXT_PROVIDER_ENV_KEYS[name].map((key) => process.env[key]?.trim()).find(Boolean) ?? "";
}

function getProviderBaseUrl(name: TextProviderName) {
  if (name === "glm") return "https://open.bigmodel.cn/api/paas/v4";
  if (name === "kimi") {
    return normalizeBaseUrl(
      process.env.KIMI_BASE_URL ??
        process.env.KSPMAS_BASE_URL ??
        process.env.MOONSHOT_BASE_URL ??
        "https://api.moonshot.ai/v1",
    );
  }
  return "https://api.deepseek.com/v1";
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed === "https://kspmas.ksyun.com") return "https://kspmas.ksyun.com/v1";
  return trimmed;
}

function parseJSONWithTolerance<T>(text: string): T {
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error(`模型未返回合法 JSON：${text.slice(0, 200)}`);
  }
}

async function wrapProviderError(providerName: TextProviderName, response: Response) {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => "");
  }
  return new Error(`${providerName} API error ${response.status}: ${detail || response.statusText}`);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enumValue<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const raw = stringValue(value);
  return options.includes(raw) ? raw as T[number] : fallback;
}

function optionalEnum<T extends readonly string[]>(value: unknown, options: T): T[number] | null {
  const raw = stringValue(value);
  return raw && options.includes(raw) ? raw as T[number] : null;
}

function optionalBoundedNumber(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(stringValue(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "未命名资料";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
