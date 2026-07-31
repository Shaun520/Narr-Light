import { describe, expect, it } from "vitest";
import {
  areCandidatesSimilar,
  dedupeCandidates,
  parseJSONWithTolerance,
  sanitizeCandidates,
  type ExtractionResponse,
} from "@/lib/services/knowledge-intake-sanitize";

const DOCUMENT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_CONTENT = "每个关键结论至少需要两条线索支撑，其中一条可以是直接证据，另一条来自证词矛盾。";

// 两两相似度足够低的一批内容，用于多候选场景下避开去重收缩
const CONTENT_POOL = [
  "搜证轮次与线索功能的对应关系需要提前规划，避免玩家中途失去推理方向。",
  "盘问环节必须给每个角色留出可被验证的矛盾点，并提供足够的对质空间。",
  "投票前应完成一次信息回收，确保玩家掌握推理出结论所需的最低线索量。",
  "复盘部分要按动机、条件、时间线、证据链的顺序完整还原案件全貌。",
  "凶手动机需要有个人经历支撑，不能只靠一句利益冲突交代犯罪原因。",
  "误导线索必须能被后续证据纠正，不能依赖结尾强行反转来制造意外。",
  "时间线设计要让每个角色在关键时段都有可查证的行为轨迹记录，不留空白区间。",
  "不在场证明需要安排独立的第三方信息源进行交叉验证，单人口述不足为凭。",
  "核心诡计的提示要分散在多名角色的视角里，单点信息不能破解全局。",
  "反转点之前应埋设至少两处看似无关的细节，回收时形成证据闭环。",
  "阵营划分要给出明确的利益冲突和目标差异，避免玩家无依据站队。",
  "暗线关系只暴露行为痕迹与异常举动，不能提前解释关系本身的成因和背景。",
  "目击证词之间要保留可被玩家发现的小时级偏差，供敏锐玩家建立突破口。",
  "证词与物证冲突时，应优先让玩家怀疑证词动机而非否定证据本身。",
  "物证的发现顺序要控制信息释放节奏，关键证据不宜在同一轮全部出现。",
];

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
        { title: "质检", content: CONTENT_POOL[0], category: "quality_metric" },
        { title: "反例", content: CONTENT_POOL[1], category: "anti_pattern" },
        { title: "普通", content: CONTENT_POOL[2], category: "structure_rule" },
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
        { title: "低权重", content: CONTENT_POOL[3], weight: -5 },
        { title: "高权重", content: CONTENT_POOL[4], weight: 9999 },
        { title: "无权重", content: CONTENT_POOL[5] },
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
    const rows = CONTENT_POOL.map((content, index) => ({
      title: `候选${index}`,
      content,
    }));

    expect(sanitizeCandidates(buildRaw(rows), DOCUMENT_ID, "deepseek", "m")).toHaveLength(12);
  });

  describe("候选去重", () => {
    it("标题归一化后相同即判重，保留先出现的一条", () => {
      const result = sanitizeCandidates(
        buildRaw([
          { title: "双线索支撑规则", content: VALID_CONTENT },
          { title: "双线索支撑规则！ ", content: CONTENT_POOL[0] },
        ]),
        DOCUMENT_ID,
        "deepseek",
        "m",
      );

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(VALID_CONTENT);
    });

    it("正文仅个别字差异时按相似度判重", () => {
      const result = sanitizeCandidates(
        buildRaw([
          { title: "双线索支撑规则", content: VALID_CONTENT },
          { title: "关键结论证据规则", content: VALID_CONTENT.replace("两条", "三条") },
        ]),
        DOCUMENT_ID,
        "deepseek",
        "m",
      );

      expect(result).toHaveLength(1);
    });

    it("标题与内容均明显不同的候选全部保留", () => {
      const result = sanitizeCandidates(
        buildRaw([
          { title: "搜证节奏", content: CONTENT_POOL[0] },
          { title: "凶手动机", content: CONTENT_POOL[4] },
          { title: "证词冲突", content: CONTENT_POOL[13] },
        ]),
        DOCUMENT_ID,
        "deepseek",
        "m",
      );

      expect(result).toHaveLength(3);
    });

    it("dedupeCandidates 与历史参照比对并统计跳过数量", () => {
      const { kept, dropped } = dedupeCandidates(
        [
          { title: "已有规则", content: VALID_CONTENT },
          { title: "全新规则", content: CONTENT_POOL[7] },
        ],
        [{ title: "库中规则", content: VALID_CONTENT }],
      );

      expect(kept).toHaveLength(1);
      expect(kept[0].title).toBe("全新规则");
      expect(dropped).toBe(1);
    });

    it("areCandidatesSimilar 空内容不判重", () => {
      expect(areCandidatesSimilar({ title: "甲", content: "" }, { title: "乙", content: "" })).toBe(false);
    });
  });

  it("candidates 不是数组时返回空结果", () => {
    expect(sanitizeCandidates(buildRaw(null), DOCUMENT_ID, "deepseek", "m")).toEqual([]);
    expect(sanitizeCandidates(buildRaw(undefined), DOCUMENT_ID, "deepseek", "m")).toEqual([]);
  });
});
