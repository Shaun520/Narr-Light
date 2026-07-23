import type {
  ScriptGenerationParams,
  AgeRating,
  WritingStyle,
} from '@/lib/ai/prompts/script-generation';
import type { ScriptGenre, ScriptDifficulty } from '@/types';

export type { ScriptGenerationParams, AgeRating, WritingStyle };

export type StoryBibleParams = ScriptGenerationParams;

export interface StoryCharacterNode {
  name: string;
  identity: string;
  secret: string;
}

export interface StoryRelationEdge {
  from: string;
  to: string;
  type: 'family' | 'friend' | 'lover' | 'enemy' | 'colleague' | 'conspiracy' | 'other';
  label: string;
  isHidden: boolean;
}

export interface ForeshadowingPlan {
  id: string;
  description: string;
  plantAct: number;
  payoffAct: number;
}

export interface StoryBibleJson {
  murdererName: string;
  murderMethod: string;
  coreTrick: string;
  motiveChain: string;
  characterSkeleton: { nodes: StoryCharacterNode[]; edges: StoryRelationEdge[] };
  timelineOutline: string;
  truthSummary: string;
  foreshadowingPlan: ForeshadowingPlan[];
}

const GENRE_LABEL: Record<ScriptGenre, string> = {
  hardcore: '硬核推理',
  emotion: '情感沉浸',
  horror: '恐怖惊悚',
  funny: '欢乐机制',
  mechanism: '机制对抗',
};

const DIFFICULTY_LABEL: Record<ScriptDifficulty, string> = {
  beginner: '新手',
  intermediate: '进阶',
  advanced: '烧脑',
  expert: '专家',
};

const AGE_RATING_LABEL: Record<AgeRating, string> = {
  ALL: '全年龄',
  TWELVE_PLUS: '12+',
  SIXTEEN_PLUS: '16+',
  EIGHTEEN_PLUS: '18+',
};

export function buildStoryBibleSystemPrompt(): string {
  return `你是资深剧本杀结构设计师，负责生成全本的设定本 Story Bible。

设定本是后续人物、分幕、玩家剧本、线索和复盘的唯一源头。你必须先尊重用户给出的文化框架、时代地域、关键场景、故事气质、案件类型和避免元素，再设计诡计。

重要风格约束：
1. 不要在用户未指定时自动套用日式推理、日式学校、神社、温泉旅馆、财阀、洋馆、昭和/大正、日文姓名等高频模板。
2. 如果用户写了中国本土、民国、古镇、山庄、书院、宗族、商会等信息，人物姓名、社会关系、地名、物件和制度都要匹配该文化语境。
3. 如果用户填写“避免元素”，这些元素不得出现在核心设定、人物身份、场景和线索里。
4. 允许使用本格推理技法，但技法必须服务于用户指定的背景，不得把背景改写成日本模板。

必须遵守：
1. 只返回合法 JSON，不要 markdown 代码块，不要解释性文字。
2. characterSkeleton.nodes 数量必须严格等于玩家人数；用户写 7 人就 exactly 7 个 nodes，不多不少。
3. murdererName 必须出现在 characterSkeleton.nodes 中。
4. 凶案手法必须物理可行，并能被线索回收。
5. 每个玩家都要有动机、秘密和可推进主线的信息差。
6. foreshadowingPlan 的 payoffAct 必须大于等于 plantAct。
7. 不展开完整玩家剧本，只产出蓝图级设定。

JSON 结构：
{
  "murdererName": "人物姓名",
  "murderMethod": "作案手法，含可行性和伪装方式",
  "coreTrick": "核心诡计，例如时间线、空间、身份、证词、物证或叙述层面的误导",
  "motiveChain": "凶手动机与其他人物利益冲突",
  "characterSkeleton": {
    "nodes": [
      { "name": "人物姓名", "identity": "公开身份", "secret": "隐藏秘密" }
    ],
    "edges": [
      { "from": "人物A", "to": "人物B", "type": "enemy", "label": "关系说明", "isHidden": true }
    ]
  },
  "timelineOutline": "按日序或时段列出关键事件链",
  "truthSummary": "真相复盘摘要",
  "foreshadowingPlan": [
    { "id": "F1", "description": "伏笔说明", "plantAct": 1, "payoffAct": 3 }
  ]
}`;
}

export function buildStoryBibleUserPrompt(params: ScriptGenerationParams): string {
  const lines: string[] = [
    `剧本标题：${params.title}`,
    `题材：${GENRE_LABEL[params.genre]}`,
    `玩家人数：${params.players} 人`,
    `预计时长：${params.duration} 小时`,
    `难度：${DIFFICULTY_LABEL[params.difficulty]}`,
    `文化框架：${params.culturalFrame || '中国本土'}`,
    `故事气质：${params.storyTone || '本格推理'}`,
    `案件类型：${params.caseType || '无明确偏好'}`,
    `背景设定：${params.background || '请自由发挥，但必须契合文化框架和题材'}`,
    `关键场景：${params.keyLocations || '请根据背景设定合理设计，不要套用默认日式场景'}`,
    `核心立意：${params.theme || '请自由发挥'}`,
    `避免元素：${params.avoidElements || '未填写。默认不要使用日式学校、神社、温泉、财阀、昭和/大正、日文姓名等模板元素。'}`,
    `适龄分级：${AGE_RATING_LABEL[params.ageRating]}`,
    `写作风格：${params.writingStyle}`,
  ];

  if (params.switches.noEdgeRole) {
    lines.push('特殊要求：无边缘位，所有玩家都要有戏份、秘密、动机和推进主线的线索价值。');
  }
  if (params.switches.compliancePreCheck) {
    lines.push('合规预检：避免露骨血腥、歧视性表达和不必要的敏感描写。');
  }
  if (params.switches.mechanismRules) {
    lines.push('特殊要求：机制本，需要预留机制环节、验证节点和玩家行动目标。');
  }
  if (params.extraReq) {
    lines.push(`附加要求：${params.extraReq}`);
  }

  lines.push('');
  lines.push(`请按系统提示的 JSON 结构生成设定本。characterSkeleton.nodes 必须刚好 ${params.players} 个。`);

  return lines.join('\n');
}

export function buildStoryBiblePrompt(params: ScriptGenerationParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildStoryBibleSystemPrompt(),
    userPrompt: buildStoryBibleUserPrompt(params),
  };
}
