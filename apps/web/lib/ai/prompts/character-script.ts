import type {
  ScriptGenerationParams,
  AgeRating,
  WritingStyle,
} from '@/lib/ai/prompts/script-generation';
import type { ScriptGenre, ScriptDifficulty } from '@/types';
import type { StoryBibleJson } from '@/lib/ai/prompts/story-bible';
import type { CharacterProfile } from '@/lib/ai/prompts/character-profiles';
import type { ActStructureJson } from '@/lib/ai/prompts/act-structure';
import type { GenerationSpec } from '@/lib/generation/spec';

export type { ScriptGenerationParams, AgeRating, WritingStyle };

export interface CharacterScriptParams {
  params: ScriptGenerationParams;
  storyBible: StoryBibleJson;
  character: CharacterProfile;
  actStructure: ActStructureJson;
  spec?: GenerationSpec;
  part?: {
    index: number;
    label: string;
    actOrder?: number;
  };
}

export interface CharacterActScript {
  actTitle: string;
  content: string;
  scenes: {
    title: string;
    content: string;
  }[];
}

export interface CharacterScriptJson {
  characterName: string;
  actScripts: CharacterActScript[];
  personalArc: string;
  visibleClueTitles: string[];
  perspectiveNote: string;
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

export function buildCharacterScriptSystemPrompt(isMurderer: boolean): string {
  const perspectiveConstraint = isMurderer
    ? `当前玩家身份是凶手或掌握关键真相的人。可以写入作案过程、伪装、反侦察、真实时间线和内心计算，但要通过主观叙述、遮蔽措辞和误导性动机保持阅读悬念，不能在开篇直白暴露所有答案。`
    : `当前玩家身份不是凶手。只能写该玩家在当时能看见、听见、推断或误解的信息；不得写其他人的内心独白、完整作案过程、幕后交易、隐藏关系和最终真相。`;

  return `你是资深剧本杀编剧，正在为单名玩家撰写可直接发放的玩家剧本。

${perspectiveConstraint}

必须遵守：
1. 只返回合法 JSON，不要 markdown 代码块，不要解释性文字。
2. actScripts 必须覆盖要求的幕次；如果只要求单幕，就只写该幕。
3. 正文要有足够篇幅，重点扩写玩家视角的经历、观察、误判、关系压力、动机变化和搜证前后的认知变化。
4. 字数统计只看可读正文：personalArc、perspectiveNote、actScripts[].content、actScripts[].scenes[].content、visibleClueTitles，不包括 JSON 字段名。
5. scenes 只写当前玩家参与或能合理得知的场景，不要泄露视角外真相。
6. visibleClueTitles 写该玩家可见或应重点关注的线索标题。

JSON 结构：
{
  "characterName": "玩家身份名",
  "actScripts": [
    {
      "actTitle": "第一幕 · 标题",
      "content": "本幕玩家正文，写清楚经历、心理、关系和可疑点。",
      "scenes": [
        {
          "title": "场景标题",
          "content": "该玩家在本场景中的所见所闻、行动、判断和误会。"
        }
      ]
    }
  ],
  "personalArc": "该玩家从开场到结局前的个人动机、情绪和行动线。",
  "visibleClueTitles": ["线索标题一", "线索标题二"],
  "perspectiveNote": "明确说明该玩家不知道哪些关键信息，以及应该保留哪些误导。"
}`;
}

export function buildCharacterScriptUserPrompt(input: CharacterScriptParams): string {
  const { params, storyBible, character, actStructure, spec, part } = input;
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
    lines.push('最低字数规格，必须满足：');
    lines.push(`- 当前这一本玩家剧本的可读正文不少于 ${spec.minWordsPerCharacterScriptPiece} 字。`);
    lines.push(`- 该玩家全部剧本合计不少于 ${spec.minCharacterScriptWords} 字。`);
    lines.push(`- 每名玩家 ${spec.scriptsPerPlayer} 本玩家剧本，全本共 ${spec.totalCharacterScriptCount} 本。`);
    lines.push('- 字数不足时，优先扩写每幕 content 和 scenes[].content，不要用空话、重复句或字段堆砌凑字数。');
    if (part?.actOrder) {
      lines.push(`- 当前只生成第 ${part.actOrder} 幕对应的玩家剧本。`);
    } else {
      lines.push(`- 当前必须覆盖 ${spec.actCount} 幕。`);
    }
  }

  if (part) {
    lines.push('');
    lines.push('当前玩家剧本分册：');
    lines.push(`- 第 ${part.index} 本：${part.label}`);
  }

  if (params.switches.noEdgeRole) {
    lines.push('特殊要求：无边缘位，所有玩家都要有可推进主线的行动、秘密和信息差。');
  }
  if (params.extraReq) {
    lines.push(`附加要求：${params.extraReq}`);
  }

  lines.push('');
  lines.push('当前玩家身份：');
  lines.push(`姓名：${character.name}`);
  lines.push(`身份：${character.roleIdentity}`);
  lines.push(`性别：${character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '未知'}`);
  lines.push(`年龄：${character.age ?? '未指定'}`);
  lines.push(`性格：${character.personality}`);
  lines.push(`背景故事：${character.backgroundStory}`);
  lines.push(`个人任务：${character.personalTask}`);
  lines.push(`是否凶手：${character.isMurderer ? '是' : '否'}`);

  lines.push('');
  lines.push('设定本：');
  if (character.isMurderer) {
    lines.push(`凶手：${storyBible.murdererName}`);
    lines.push(`作案手法：${storyBible.murderMethod}`);
    lines.push(`核心诡计：${storyBible.coreTrick}`);
    lines.push(`动机链：${storyBible.motiveChain}`);
    lines.push(`时间线大纲：${storyBible.timelineOutline}`);
    lines.push(`真相梗概：${storyBible.truthSummary}`);
  } else {
    lines.push(`公开可知的案件表象：${storyBible.murderMethod}`);
    lines.push(`时间线大纲：${storyBible.timelineOutline}`);
    lines.push('真相梗概：当前玩家不知道完整真相，请只作为视角过滤依据，不能直接泄露。');
  }

  lines.push('');
  lines.push('人物关系骨架：');
  for (const node of storyBible.characterSkeleton.nodes) {
    lines.push(`- ${node.name}（${node.identity}）：${node.secret}`);
  }
  for (const edge of storyBible.characterSkeleton.edges) {
    if (character.isMurderer || !edge.isHidden) {
      lines.push(`- ${edge.from} -> ${edge.to}（${edge.type}）：${edge.label}${edge.isHidden ? ' [暗线]' : ''}`);
    }
  }

  lines.push('');
  lines.push('伏笔清单：');
  for (const f of storyBible.foreshadowingPlan) {
    lines.push(`- ${f.id}：${f.description}（埋设于第 ${f.plantAct} 幕，回收于第 ${f.payoffAct} 幕）`);
  }

  lines.push('');
  lines.push('分幕结构：');
  for (const act of actStructure.acts) {
    if (part?.actOrder && act.sortOrder !== part.actOrder) continue;
    lines.push(`- 第 ${act.sortOrder} 幕：${act.title}：${act.content}`);
    for (const scene of act.scenes) {
      lines.push(`  - 场景 ${scene.sortOrder}：${scene.title}，地点：${scene.location}，概要：${scene.content}`);
    }
    for (const sr of act.searchRounds) {
      lines.push(`  - 搜证轮次 ${sr.round}：${sr.locations.join('、')}`);
    }
  }

  lines.push('');
  lines.push('请按系统提示的 JSON 结构，撰写当前玩家可直接阅读的玩家剧本。');

  return lines.join('\n');
}

export function buildCharacterScriptPrompt(input: CharacterScriptParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildCharacterScriptSystemPrompt(input.character.isMurderer),
    userPrompt: buildCharacterScriptUserPrompt(input),
  };
}
