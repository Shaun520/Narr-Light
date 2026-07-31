import {
  KNOWLEDGE_ABSTRACTION_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  QUALITY_RISK_LEVELS,
  type KnowledgeAbstractionLevel,
  type KnowledgeCategory,
  type KnowledgeModuleType,
  type KnowledgeStage,
  type QualityRiskLevel,
  type TextProviderName,
} from "@narrlight/shared";

const MAX_CANDIDATES = 12;

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

export type ExtractionResponse = {
  documentSummary?: unknown;
  candidates?: unknown;
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

export function sanitizeCandidates(
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

export function parseJSONWithTolerance<T>(text: string): T {
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
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(min, Math.min(max, Math.floor(value)));
  }
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
