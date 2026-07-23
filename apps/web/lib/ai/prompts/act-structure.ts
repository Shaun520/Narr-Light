import type {
  ScriptGenerationParams,
  AgeRating,
  WritingStyle,
} from '@/lib/ai/prompts/script-generation';
import type { ScriptGenre, ScriptDifficulty } from '@/types';
import type { StoryBibleJson } from '@/lib/ai/prompts/story-bible';
import type { GenerationSpec } from '@/lib/generation/spec';
import { formatGenerationSpec } from '@/lib/generation/spec';

export type { ScriptGenerationParams, AgeRating, WritingStyle };

export interface ActStructureParams {
  params: ScriptGenerationParams;
  storyBible: StoryBibleJson;
  spec?: GenerationSpec;
}

export interface SearchRound {
  round: number;
  locations: string[];
}

export interface ActScene {
  title: string;
  location: string;
  content: string;
  sortOrder: number;
}

export interface ActStructure {
  title: string;
  sortOrder: number;
  content: string;
  scenes: ActScene[];
  searchRounds: SearchRound[];
}

export interface ActStructureJson {
  acts: ActStructure[];
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

export function buildActStructureSystemPrompt(): string {
  return `你是资深剧本杀结构设计师，负责把设定本拆成可执行的分幕、场景和搜证轮次。

必须遵守：
1. 只返回合法 JSON，不要 markdown 代码块，不要解释性文字。
2. 幕次、搜证轮次、场景数量必须满足用户给出的最低结构规格。
3. 每幕 content 写结构概要，不展开完整玩家正文。
4. 每个 scene 必须有 title、location、content、sortOrder。
5. searchRounds[].locations 必须给线索卡阶段提供可搜证地点。
6. 伏笔 plantAct/payoffAct 要落在对应幕次，不能丢失。

JSON 结构：
{
  "acts": [
    {
      "title": "第一幕 · 开局事件",
      "sortOrder": 1,
      "content": "本幕功能、冲突、信息释放和玩家目标。",
      "scenes": [
        {
          "title": "场景标题",
          "location": "具体地点",
          "content": "本场景发生什么，以及承载什么线索或关系变化。",
          "sortOrder": 1
        }
      ],
      "searchRounds": [
        {
          "round": 1,
          "locations": ["地点一", "地点二"]
        }
      ]
    }
  ]
}`;
}

export function buildActStructureUserPrompt(input: ActStructureParams): string {
  const { params, storyBible, spec } = input;
  const lines: string[] = ['创作参数：'];
  lines.push(`剧本标题：${params.title}`);
  lines.push(`题材：${GENRE_LABEL[params.genre]}`);
  lines.push(`玩家人数：${params.players} 人`);
  lines.push(`预计时长：${params.duration} 小时`);
  lines.push(`难度：${DIFFICULTY_LABEL[params.difficulty]}`);
  lines.push(`适龄分级：${AGE_RATING_LABEL[params.ageRating]}`);
  lines.push(`写作风格：${params.writingStyle}`);

  if (spec) {
    lines.push('');
    lines.push('最低结构规格，必须满足：');
    lines.push(formatGenerationSpec(spec));
  }

  if (params.switches.mechanismRules) {
    lines.push('特殊要求：机制本，需要在分幕中安排机制环节、验证节点和玩家行动目标。');
  }
  if (params.extraReq) {
    lines.push(`附加要求：${params.extraReq}`);
  }

  lines.push('');
  lines.push('设定本：');
  lines.push(`凶手：${storyBible.murdererName}`);
  lines.push(`作案手法：${storyBible.murderMethod}`);
  lines.push(`核心诡计：${storyBible.coreTrick}`);
  lines.push(`动机链：${storyBible.motiveChain}`);
  lines.push(`时间线大纲：${storyBible.timelineOutline}`);
  lines.push(`真相梗概：${storyBible.truthSummary}`);

  lines.push('');
  lines.push('人物关系骨架：');
  for (const node of storyBible.characterSkeleton.nodes) {
    lines.push(`- ${node.name}（${node.identity}）：${node.secret}`);
  }

  lines.push('');
  lines.push('伏笔清单：');
  for (const f of storyBible.foreshadowingPlan) {
    lines.push(`- ${f.id}：${f.description}（埋设于第 ${f.plantAct} 幕，回收于第 ${f.payoffAct} 幕）`);
  }

  lines.push('');
  lines.push('请生成分幕结构，确保幕次数、场景数、搜证轮次和伏笔落点满足最低规格。');

  return lines.join('\n');
}

export function buildActStructurePrompt(input: ActStructureParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildActStructureSystemPrompt(),
    userPrompt: buildActStructureUserPrompt(input),
  };
}
