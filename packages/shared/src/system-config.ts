// 系统配置类型与 key 常量
// 由 admin 端写入 system_configs 表，web 端通过 service role client 只读消费
// 敏感凭据（API Key）继续使用环境变量，不在此处定义

/** system_configs.key 枚举 */
export const SYSTEM_CONFIG_KEYS = [
  "text_provider",
  "image_provider",
  "content_safety",
  "quota_defaults",
  "generation_spec",
] as const;
export type SystemConfigKey = (typeof SYSTEM_CONFIG_KEYS)[number];

/** 文本 provider 名称 */
export type TextProviderName = "deepseek" | "glm" | "kimi";

/** 图像 provider 名称 */
export type ImageProviderName = "openai-image" | "seedream" | "glm";

/** 单个 provider 的运行时配置 */
export interface ProviderRuntimeConfig {
  enabled: boolean;
  model: string;
  timeout: number;
  retries: number;
  size?: string;
}

/** 文本 provider 路由配置 */
export interface TextProviderConfig {
  primary: TextProviderName;
  fallback: TextProviderName | null;
  providers: Record<TextProviderName, ProviderRuntimeConfig>;
}

/** 图像 provider 路由配置 */
export interface ImageProviderConfig {
  primary: ImageProviderName;
  fallback: ImageProviderName | null;
  providers: Partial<Record<ImageProviderName, ProviderRuntimeConfig>>;
}

/** 内容安全配置 */
export interface ContentSafetyConfig {
  enabled: boolean;
  manual_review: boolean;
}

/** 配额默认值 */
export interface QuotaDefaultsConfig {
  free_quota_limit: number;
  pro_monthly_quota: number;
  max_script_words: number;
}

export interface GenerationDurationBand {
  minDuration: number;
  maxDuration: number;
  actCount: number;
  searchRoundCount: number;
}

export interface GenerationSpecConfig {
  baseWordsPerHour: number;
  characterScriptShare: number;
  characterScriptMode: "single" | "per_act" | "custom";
  customScriptsPerPlayer: number;
  minScenesPerAct: number;
  minCluesPerRoundBase: number;
  playerClueRatio: number;
  durationBands: GenerationDurationBand[];
  difficultyMultipliers: Record<"beginner" | "intermediate" | "advanced" | "expert", number>;
  genreMultipliers: Record<"hardcore" | "emotion" | "horror" | "funny" | "mechanism", number>;
}

// 生成规格校验相关常量，与 spec.ts 中 clamp(input.duration, 2, 8) 保持一致
export const GENERATION_DURATION_MIN = 2;
export const GENERATION_DURATION_MAX = 8;

/** 校验错误项：field 用点号路径定位字段，便于前端高亮具体输入框 */
export interface GenerationSpecValidationError {
  field: string;
  message: string;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * 校验生成规格配置。
 * 校验规则：
 * 1. 基础字段必须为正数/正整数（避免目标字数为 0 或负值）。
 * 2. durationBands 各档位在 [GENERATION_DURATION_MIN, GENERATION_DURATION_MAX] 范围内，
 *    且 minDuration <= maxDuration，actCount/searchRoundCount 为正整数。
 * 3. durationBands 按 minDuration 排序后必须连续覆盖 [2, 8] 实数区间，不允许重叠或空档
 *    （相邻档位 next.minDuration <= current.maxDuration 即视为无空档，允许边界相接）。
 *    原因：buildGenerationSpecWithConfig 用 find(min<=d<=max) 查找档位，未覆盖区间会
 *    回退到 DEFAULT_GENERATION_SPEC_CONFIG.durationBands[0]，导致 admin 改动不生效。
 * 4. characterScriptMode='custom' 时 customScriptsPerPlayer 必须为正整数；
 *    下游 resolveScriptsPerPlayer 会强制 Math.max(1, ...)，这里给出前置提示。
 * 5. difficultyMultipliers / genreMultipliers 必须为正数，避免字数被乘为 0。
 */
export function validateGenerationSpecConfig(
  config: GenerationSpecConfig,
): GenerationSpecValidationError[] {
  const errors: GenerationSpecValidationError[] = [];

  // 1. 基础字段
  if (!isPositiveFinite(config.baseWordsPerHour)) {
    errors.push({ field: "baseWordsPerHour", message: "每小时目标字数必须为大于 0 的数" });
  }
  if (
    !isPositiveFinite(config.characterScriptShare) ||
    config.characterScriptShare > 1
  ) {
    errors.push({ field: "characterScriptShare", message: "角色剧本占比必须在 (0, 1] 范围内" });
  }
  if (!isPositiveInteger(config.minScenesPerAct)) {
    errors.push({ field: "minScenesPerAct", message: "每幕最低场景数必须为正整数" });
  }
  if (!isPositiveInteger(config.minCluesPerRoundBase)) {
    errors.push({ field: "minCluesPerRoundBase", message: "每轮最低线索基数必须为正整数" });
  }
  if (
    typeof config.playerClueRatio !== "number" ||
    !Number.isFinite(config.playerClueRatio) ||
    config.playerClueRatio < 0
  ) {
    errors.push({ field: "playerClueRatio", message: "人数线索比例不能为负数" });
  }

  // 2. customScriptsPerPlayer（仅 custom 模式下需要校验）
  if (config.characterScriptMode === "custom") {
    if (!isPositiveInteger(config.customScriptsPerPlayer)) {
      errors.push({
        field: "customScriptsPerPlayer",
        message:
          "自定义模式下每名玩家剧本数必须为正整数（小于 1 时下游会强制为 1，请调整配置）",
      });
    }
  }

  // 3. durationBands
  if (!Array.isArray(config.durationBands) || config.durationBands.length === 0) {
    errors.push({ field: "durationBands", message: "时长档位至少需要一条" });
  } else {
    config.durationBands.forEach((band, index) => {
      const bandField = `durationBands[${index}]`;
      if (
        typeof band.minDuration !== "number" ||
        !Number.isFinite(band.minDuration) ||
        band.minDuration < GENERATION_DURATION_MIN
      ) {
        errors.push({
          field: `${bandField}.minDuration`,
          message: `档位 ${index + 1} 最小时长不能小于 ${GENERATION_DURATION_MIN}`,
        });
      }
      if (
        typeof band.maxDuration !== "number" ||
        !Number.isFinite(band.maxDuration) ||
        band.maxDuration > GENERATION_DURATION_MAX
      ) {
        errors.push({
          field: `${bandField}.maxDuration`,
          message: `档位 ${index + 1} 最大时长不能大于 ${GENERATION_DURATION_MAX}`,
        });
      }
      if (
        typeof band.minDuration === "number" &&
        typeof band.maxDuration === "number" &&
        Number.isFinite(band.minDuration) &&
        Number.isFinite(band.maxDuration) &&
        band.minDuration > band.maxDuration
      ) {
        errors.push({
          field: bandField,
          message: `档位 ${index + 1} 最小时长不能大于最大时长`,
        });
      }
      if (!isPositiveInteger(band.actCount)) {
        errors.push({
          field: `${bandField}.actCount`,
          message: `档位 ${index + 1} 生成幕数必须为正整数`,
        });
      }
      if (!isPositiveInteger(band.searchRoundCount)) {
        errors.push({
          field: `${bandField}.searchRoundCount`,
          message: `档位 ${index + 1} 搜证轮次必须为正整数`,
        });
      }
    });

    // 排序后做重叠与覆盖校验，避免原始顺序影响判断
    const sortedBands = [...config.durationBands]
      .map((band, originIndex) => ({ band, originIndex }))
      .sort((a, b) => a.band.minDuration - b.band.minDuration);

    // 3a. 区间重叠 / 空档校验（按排序后相邻档位判断）
    for (let i = 0; i < sortedBands.length - 1; i++) {
      const current = sortedBands[i].band;
      const next = sortedBands[i + 1].band;
      if (current.maxDuration < next.minDuration) {
        errors.push({
          field: "durationBands",
          message: `档位之间存在空档：[${current.minDuration}-${current.maxDuration}] 与 [${next.minDuration}-${next.maxDuration}] 之间未覆盖 ${current.maxDuration}~${next.minDuration} 小时，buildGenerationSpec 会回退到默认第一档`,
        });
      }
    }

    // 3b. 覆盖 [2, 8] 全范围
    if (sortedBands[0].band.minDuration > GENERATION_DURATION_MIN) {
      errors.push({
        field: "durationBands",
        message: `时长档位未覆盖 ${GENERATION_DURATION_MIN} 小时起点（当前起点为 ${sortedBands[0].band.minDuration}）`,
      });
    }
    const lastBand = sortedBands[sortedBands.length - 1].band;
    if (lastBand.maxDuration < GENERATION_DURATION_MAX) {
      errors.push({
        field: "durationBands",
        message: `时长档位未覆盖 ${GENERATION_DURATION_MAX} 小时终点（当前终点为 ${lastBand.maxDuration}）`,
      });
    }
  }

  // 4. difficultyMultipliers
  const difficultyKeys = ["beginner", "intermediate", "advanced", "expert"] as const;
  const difficultyLabels: Record<(typeof difficultyKeys)[number], string> = {
    beginner: "新手",
    intermediate: "进阶",
    advanced: "烧脑",
    expert: "专家",
  };
  difficultyKeys.forEach((key) => {
    if (!isPositiveFinite(config.difficultyMultipliers?.[key])) {
      errors.push({
        field: `difficultyMultipliers.${key}`,
        message: `难度系数「${difficultyLabels[key]}」必须为大于 0 的数（0 或负值会导致目标字数为 0）`,
      });
    }
  });

  // 5. genreMultipliers
  const genreKeys = ["hardcore", "emotion", "horror", "funny", "mechanism"] as const;
  const genreLabels: Record<(typeof genreKeys)[number], string> = {
    hardcore: "硬核",
    emotion: "情感",
    horror: "恐怖",
    funny: "欢乐",
    mechanism: "机制",
  };
  genreKeys.forEach((key) => {
    if (!isPositiveFinite(config.genreMultipliers?.[key])) {
      errors.push({
        field: `genreMultipliers.${key}`,
        message: `题材系数「${genreLabels[key]}」必须为大于 0 的数（0 或负值会导致目标字数为 0）`,
      });
    }
  });

  return errors;
}

/** 便捷方法：返回首个匹配字段的错误信息，便于前端针对单个输入框显示 */
export function findSpecError(
  errors: GenerationSpecValidationError[],
  field: string,
): string | undefined {
  return errors.find((item) => item.field === field)?.message;
}
