import { describe, expect, it } from "vitest";
import {
  parseJSONWithTolerance,
  sanitizeCandidates,
  type ExtractionResponse,
} from "@/lib/services/knowledge-intake-sanitize";

const DOCUMENT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_CONTENT = "每个关键结论至少需要两条线索支撑，其中一条可以是直接证据，另一条来自证词矛盾。";

function buildRaw(candidates: unknown, documentSummary?: unknown): ExtractionResponse {
  return { documentSummary: documentSummary ?? "资料结构摘要", candidates };
}

describe("parseJSONWithTolerance", () => {
  it("直接解析合法 JSON", () => {
    const result = parseJSONWithTolerance<{ a: number }>('{"a":1}');
    expect(result.a).toBe(1);
  });

  it("剥离 markdown 代码围栏", () => {
    const result = parseJSONWithTolerance<{ a: number }>('```json\n{"a":1}\n```');
    expect(result.a).toBe(1);
  });

  it("剥离无语言标记的代码围栏", () => {
    const result = parseJSONWithTolerance<{ a: number }>('```\n{"a":1}\n```');
    expect(result.a).toBe(1);
  });

  it("裁剪 JSON 前后的多余文本", () => {
    const result = parseJSONWithTolerance<{ a: number }>('这是前缀说明 {"a":1} 这是后缀');
    expect(result.a).toBe(1);
  });

  it("字符串值内包含花括号时通过围栏路径解析", () => {
    const text = '```json\n{"a":"包含 {嵌套} 的文本"}\n```';
    const result = parseJSONWithTolerance<{ a: string }>(text);
    expect(result.a).toBe("包含 {嵌套} 的文本");
  });

  it("完全无法解析时抛出带内容摘要的错误", () => {
    expect(() => parseJSONWithTolerance("这不是 JSON")).toThrow("模型未返回合法 JSON");
  });
});

describe("sanitizeCandidates", () => {
  it("透传合法候选的全部字段", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw([
        {
          title: "关键结论双线索支撑规则",
          content: VALID_CONTENT,
          category: "clue_pattern",
          moduleType: "clues",
          stage: "clues",
          genre: "hardcore",
          playerCountMin: 4,
          playerCountMax: 8,
          difficulty: "advanced",
          abstractionLevel: "rule",
          riskLevel: "low",
          weight: 200,
        },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "deepseek-chat",
    );

    expect(candidate.title).toBe("关键结论双线索支撑规则");
    expect(candidate.category).toBe("clue_pattern");
    expect(candidate.module_type).toBe("clues");
    expect(candidate.stage).toBe("clues");
    expect(candidate.genre).toBe("hardcore");
    expect(candidate.player_count_min).toBe(4);
    expect(candidate.player_count_max).toBe(8);
    expect(candidate.difficulty).toBe("advanced");
    expect(candidate.abstraction_level).toBe("rule");
    expect(candidate.risk_level).toBe("low");
    expect(candidate.weight).toBe(200);
    expect(candidate.source_context.documentId).toBe(DOCUMENT_ID);
    expect(candidate.metadata.extractorProvider).toBe("deepseek");
    expect(candidate.metadata.extractorModel).toBe("deepseek-chat");
  });

  it("标题为空或内容不足 30 字时丢弃该候选", () => {
    const result = sanitizeCandidates(
      buildRaw([
        { title: "", content: VALID_CONTENT },
        { title: "内容过短", content: "太短" },
        { title: "合法候选", content: VALID_CONTENT },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("合法候选");
  });

  it("超长标题和内容按上限截断", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw([{ title: "标".repeat(200), content: VALID_CONTENT.repeat(100) }]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(candidate.title).toHaveLength(120);
    expect(candidate.content).toHaveLength(1200);
  });

  it("未知枚举回落到默认值", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw([
        {
          title: "非法枚举",
          content: VALID_CONTENT,
          category: "invented",
          moduleType: "invented",
          stage: "invented",
          genre: "invented",
          difficulty: "invented",
          riskLevel: "invented",
        },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(candidate.category).toBe("structure_rule");
    expect(candidate.module_type).toBe("case_core");
    expect(candidate.stage).toBe("case_core");
    expect(candidate.genre).toBeNull();
    expect(candidate.difficulty).toBeNull();
    expect(candidate.risk_level).toBe("medium");
  });

  it("抽象层级缺省时按类型推断", () => {
    const [metric, anti, plain] = sanitizeCandidates(
      buildRaw([
        { title: "质检", content: VALID_CONTENT, category: "quality_metric" },
        { title: "反例", content: VALID_CONTENT, category: "anti_pattern" },
        { title: "普通", content: VALID_CONTENT, category: "structure_rule" },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(metric.abstraction_level).toBe("quality_metric");
    expect(anti.abstraction_level).toBe("anti_pattern");
    expect(plain.abstraction_level).toBe("pattern");
  });

  it("兼容 snake_case 字段名", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw([
        {
          title: "蛇形字段",
          content: VALID_CONTENT,
          module_type: "player_script",
          player_count_min: 5,
          player_count_max: 9,
          abstraction_level: "summary",
          risk_level: "high",
          source_context: { basis: "结构观察" },
        },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(candidate.module_type).toBe("player_script");
    expect(candidate.player_count_min).toBe(5);
    expect(candidate.player_count_max).toBe(9);
    expect(candidate.abstraction_level).toBe("summary");
    expect(candidate.risk_level).toBe("high");
    expect(candidate.source_context.basis).toBe("结构观察");
  });

  it("合并驼峰与蛇形的 sourceContext 并附加资料信息", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw(
        [
          {
            title: "来源合并",
            content: VALID_CONTENT,
            sourceContext: { basis: "驼峰" },
            source_context: { copyRisk: "low" },
          },
        ],
        "摘".repeat(300),
      ),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(candidate.source_context.basis).toBe("驼峰");
    expect(candidate.source_context.copyRisk).toBe("low");
    expect(candidate.source_context.documentId).toBe(DOCUMENT_ID);
    expect(candidate.source_context.documentSummary).toHaveLength(240);
  });

  it("权重越界截断到 0-1000，缺省为 100", () => {
    const [low, high, missing] = sanitizeCandidates(
      buildRaw([
        { title: "低权重", content: VALID_CONTENT, weight: -5 },
        { title: "高权重", content: VALID_CONTENT, weight: 9999 },
        { title: "无权重", content: VALID_CONTENT },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(low.weight).toBe(0);
    expect(high.weight).toBe(1000);
    expect(missing.weight).toBe(100);
  });

  it("人数字段截断到 1-12，非法值为 null", () => {
    const [candidate] = sanitizeCandidates(
      buildRaw([
        { title: "人数", content: VALID_CONTENT, playerCountMin: 0, playerCountMax: 99, difficulty: "expert" },
      ]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );

    expect(candidate.player_count_min).toBe(1);
    expect(candidate.player_count_max).toBe(12);

    const [invalid] = sanitizeCandidates(
      buildRaw([{ title: "人数非法", content: VALID_CONTENT, playerCountMin: "abc" }]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );
    expect(invalid.player_count_min).toBeNull();

    const [missing] = sanitizeCandidates(
      buildRaw([{ title: "人数缺省", content: VALID_CONTENT }]),
      DOCUMENT_ID,
      "deepseek",
      "m",
    );
    expect(missing.player_count_min).toBeNull();
    expect(missing.player_count_max).toBeNull();
  });

  it("候选超过 12 条时截断", () => {
    const rows = Array.from({ length: 15 }, (_, index) => ({
      title: `候选${index}`,
      content: VALID_CONTENT,
    }));

    expect(sanitizeCandidates(buildRaw(rows), DOCUMENT_ID, "deepseek", "m")).toHaveLength(12);
  });

  it("candidates 不是数组时返回空结果", () => {
    expect(sanitizeCandidates(buildRaw(null), DOCUMENT_ID, "deepseek", "m")).toEqual([]);
    expect(sanitizeCandidates(buildRaw(undefined), DOCUMENT_ID, "deepseek", "m")).toEqual([]);
  });
});
