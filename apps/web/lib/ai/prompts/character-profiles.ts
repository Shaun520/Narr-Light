/**
 * 人物设定（Character Profiles）Prompt 模板
 */
import type {
  ScriptGenerationParams,
  AgeRating,
  WritingStyle,
} from '@/lib/ai/prompts/script-generation';
import type { ScriptGenre, ScriptDifficulty } from '@/types';
import type { StoryBibleJson } from '@/lib/ai/prompts/story-bible';

export type { ScriptGenerationParams, AgeRating, WritingStyle };

export interface CharacterProfilesParams {
  params: ScriptGenerationParams;
  storyBible: StoryBibleJson;
}

export interface CharacterProfile {
  name: string;
  roleIdentity: string;
  gender: 'male' | 'female' | 'unknown';
  age: number | null;
  personality: string;
  backgroundStory: string;
  personalTask: string;
  isMurderer: boolean;
  secretFromBible: string;
}

export interface CharacterProfilesJson {
  characters: CharacterProfile[];
}

const GENRE_LABEL: Record<ScriptGenre, string> = {
  hardcore: '硬核推理',
  emotion: '情感沉浸',
  horror: '恐怖悬疑',
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

export function buildCharacterProfilesSystemPrompt(): string {
  return `你是一名资深剧本杀人物设定设计师，擅长塑造立体、差异化、有秘密、有行动目标的角色。

请根据用户提供的设定本和创作参数，为剧本中的每个角色生成完整人物设定。设定本已经确定凶手、核心诡计、人物关系骨架和伏笔计划，你需要展开每个角色的身份、性格、背景、个人任务和秘密承接。

硬性要求：
1. characters 数量必须严格等于设定本 characterSkeleton.nodes 数量。
2. 每个 characters[i].name 必须与设定本 characterSkeleton.nodes 中的 name 完全一致，不得改名、增删或合并角色。
3. 凶手角色 isMurderer 必须为 true，且只有凶手为 true。
4. secretFromBible 必须复制并承接设定本对应节点的 secret。
5. 每个角色都要有可推动主线的 personalTask，避免边缘化。
6. 不要写完整角色剧本、对白或长场景，只输出人物设定。
7. 只返回合法 JSON，不要 markdown，不要解释。

JSON 格式：
{
  "characters": [
    {
      "name": "角色姓名",
      "roleIdentity": "公开身份或社会身份",
      "gender": "male | female | unknown",
      "age": 32,
      "personality": "性格特征，突出差异化",
      "backgroundStory": "与主线、旧案或关系网有关的背景",
      "personalTask": "玩家在剧本中需要主动完成的目标",
      "isMurderer": false,
      "secretFromBible": "复制设定本对应 secret，并可用一句话补足含义"
    }
  ]
}`;
}

export function buildCharacterProfilesUserPrompt(input: CharacterProfilesParams): string {
  const { params, storyBible } = input;
  const lines: string[] = [
    '创作参数：',
    `剧本标题：${params.title}`,
    `题材：${GENRE_LABEL[params.genre]}`,
    `玩家人数：${params.players} 人`,
    `预计时长：${params.duration} 小时`,
    `难度：${DIFFICULTY_LABEL[params.difficulty]}`,
    `适龄分级：${AGE_RATING_LABEL[params.ageRating]}`,
    `写作风格：${params.writingStyle}`,
  ];

  if (params.switches.noEdgeRole) {
    lines.push('特殊要求：无边缘位，所有角色都必须有足够戏份和有效目标。');
  }
  if (params.extraReq) {
    lines.push(`附加要求：${params.extraReq}`);
  }

  lines.push('');
  lines.push('设定本：');
  lines.push(`凶手：${storyBible.murdererName}`);
  lines.push(`凶案手法：${storyBible.murderMethod}`);
  lines.push(`核心诡计：${storyBible.coreTrick}`);
  lines.push(`动机链：${storyBible.motiveChain}`);
  lines.push(`时间线大纲：${storyBible.timelineOutline}`);
  lines.push(`真相梗概：${storyBible.truthSummary}`);

  lines.push('');
  lines.push('人物关系骨架（name/identity/secret 必须严格对齐）：');
  for (const node of storyBible.characterSkeleton.nodes) {
    lines.push(`- ${node.name}（${node.identity}）：${node.secret}`);
  }

  lines.push('');
  lines.push('人物关系边：');
  for (const edge of storyBible.characterSkeleton.edges) {
    lines.push(`- ${edge.from} -> ${edge.to}（${edge.type}）：${edge.label}${edge.isHidden ? ' [暗线]' : ''}`);
  }

  lines.push('');
  lines.push('伏笔清单：');
  for (const f of storyBible.foreshadowingPlan) {
    lines.push(`- ${f.id}：${f.description}（埋设于第${f.plantAct}幕，回收于第${f.payoffAct}幕）`);
  }

  lines.push('');
  lines.push('请按系统提示词规定的 JSON 结构生成所有人物设定，确保数量、姓名、凶手身份与设定本一致。');

  return lines.join('\n');
}

export function buildCharacterProfilesPrompt(input: CharacterProfilesParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildCharacterProfilesSystemPrompt(),
    userPrompt: buildCharacterProfilesUserPrompt(input),
  };
}
