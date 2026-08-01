import "server-only";

import {
  KNOWLEDGE_ABSTRACTION_LEVELS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MODULE_TYPES,
  KNOWLEDGE_STAGES,
  QUALITY_RISK_LEVELS,
  type KnowledgeDocumentSourceType,
  type ProviderRuntimeConfig,
  type TextProviderName,
} from "@narrlight/shared";
import { getSystemConfigSnapshot } from "@/lib/services/system-config";
import {
  parseJSONWithTolerance,
  sanitizeCandidates,
  type ExtractionResponse,
  type KnowledgeCandidateInsert,
} from "@/lib/services/knowledge-intake-sanitize";

const MAX_FILE_BYTES = 1_500_000;
const MAX_PROMPT_CHARS = 28_000;

// 各文本 provider 单次响应允许的最大输出 token 数；GLM 系列上限为 4096。
// 候选最多 12 条、每条 80-300 字，4096 在长内容场景容易截断 JSON 导致整批失败。
const MAX_OUTPUT_TOKENS: Record<TextProviderName, number> = {
  deepseek: 8192,
  glm: 4096,
  kimi: 8192,
};

const TEXT_PROVIDER_ENV_KEYS: Record<TextProviderName, string[]> = {
  deepseek: ["DEEPSEEK_API_KEY"],
  glm: ["GLM_API_KEY"],
  kimi: ["KIMI_API_KEY", "KSPMAS_API_KEY", "MOONSHOT_API_KEY"],
};

// 推理模型的推理 token 与回答共用 max_tokens 预算，长回答任务容易在思考阶段耗尽预算导致回答为空。
// 抽取任务不需要推理过程，deepseek/glm 支持用 thinking.type=disabled 关闭。
const THINKING_DISABLED_PROVIDERS: readonly TextProviderName[] = ["deepseek", "glm"];

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

export type { ExtractionResponse, KnowledgeCandidateInsert };

export type KnowledgeExtractionOutput = {
  providerName: TextProviderName;
  model: string;
  rawResult: unknown;
  candidates: KnowledgeCandidateInsert[];
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
          max_tokens: MAX_OUTPUT_TOKENS[input.providerName],
          stream: false,
          ...(THINKING_DISABLED_PROVIDERS.includes(input.providerName) ? { thinking: { type: "disabled" } } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw await wrapProviderError(input.providerName, response);
      const data = (await response.json()) as ChatResponse;
      const message = data.choices?.[0]?.message;
      const content = message?.content?.trim() ?? "";
      if (content) return content;
      throw new Error(
        message?.reasoning_content
          ? "模型只返回了推理过程、未给出回答内容，请重试。"
          : "模型未返回任何内容。",
      );
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

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "未命名资料";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
