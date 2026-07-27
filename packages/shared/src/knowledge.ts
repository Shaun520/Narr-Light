export const KNOWLEDGE_CATEGORIES = [
  "structure_rule",
  "character_pattern",
  "clue_pattern",
  "timeline_pattern",
  "dm_flow_rule",
  "anti_novelization_rule",
  "quality_metric",
  "anti_pattern",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_STAGES = [
  "brief",
  "case_core",
  "characters",
  "clues",
  "acts",
  "player_script",
  "dm_manual",
  "review",
] as const;

export type KnowledgeStage = (typeof KNOWLEDGE_STAGES)[number];

export const KNOWLEDGE_MODULE_TYPES = [
  "case_core",
  "characters",
  "clues",
  "acts",
  "player_script",
  "dm_manual",
  "truth_review",
  "quality_check",
] as const;

export type KnowledgeModuleType = (typeof KNOWLEDGE_MODULE_TYPES)[number];

export const QUALITY_RISK_LEVELS = ["low", "medium", "high"] as const;

export type QualityRiskLevel = (typeof QUALITY_RISK_LEVELS)[number];

export const KNOWLEDGE_DOCUMENT_SOURCE_TYPES = ["manual", "txt", "md", "docx", "pdf"] as const;

export type KnowledgeDocumentSourceType = (typeof KNOWLEDGE_DOCUMENT_SOURCE_TYPES)[number];

export const KNOWLEDGE_DOCUMENT_PARSE_STATUSES = [
  "pending",
  "parsed",
  "failed",
  "needs_cleanup",
] as const;

export type KnowledgeDocumentParseStatus = (typeof KNOWLEDGE_DOCUMENT_PARSE_STATUSES)[number];

export const KNOWLEDGE_EXTRACTION_STATUSES = ["pending", "running", "completed", "failed"] as const;

export type KnowledgeExtractionStatus = (typeof KNOWLEDGE_EXTRACTION_STATUSES)[number];

export const KNOWLEDGE_ABSTRACTION_LEVELS = [
  "summary",
  "pattern",
  "rule",
  "anti_pattern",
  "quality_metric",
] as const;

export type KnowledgeAbstractionLevel = (typeof KNOWLEDGE_ABSTRACTION_LEVELS)[number];

export const KNOWLEDGE_CANDIDATE_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export type KnowledgeCandidateReviewStatus = (typeof KNOWLEDGE_CANDIDATE_REVIEW_STATUSES)[number];

export type GenerationQualityIssue = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
};

export type GenerationQualityReport = {
  score: number;
  riskLevel: QualityRiskLevel;
  rewriteRequired: boolean;
  issues: GenerationQualityIssue[];
  rewriteInstructions: string[];
};
