import { NextRequest } from 'next/server';
import { DeepSeekProvider, parseJSONWithTolerance } from '@/lib/ai/providers/deepseek-provider';
import { buildStoryBiblePrompt, type StoryBibleJson } from '@/lib/ai/prompts/story-bible';
import type { ScriptGenerationParams } from '@/lib/ai/prompts/script-generation';
import type { CharacterProfilesJson } from '@/lib/ai/prompts/character-profiles';
import type { ActStructureJson } from '@/lib/ai/prompts/act-structure';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

interface GenerateRequestBody {
  scriptId: string;
  params: ScriptGenerationParams;
}

function buildError(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

function encodeSse(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function validateBody(body: unknown): body is GenerateRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.scriptId !== 'string' || !b.scriptId) return false;
  if (!b.params || typeof b.params !== 'object') return false;
  const p = b.params as Record<string, unknown>;
  return typeof p.title === 'string' && typeof p.players === 'number';
}

function validateStoryBible(json: StoryBibleJson, players: number): string[] {
  const errors: string[] = [];

  if (typeof json.murdererName !== 'string' || !json.murdererName) {
    errors.push('murdererName must be a non-empty string');
  }
  if (typeof json.murderMethod !== 'string' || !json.murderMethod) {
    errors.push('murderMethod must be a non-empty string');
  }
  if (typeof json.coreTrick !== 'string' || !json.coreTrick) {
    errors.push('coreTrick must be a non-empty string');
  }
  if (typeof json.motiveChain !== 'string' || !json.motiveChain) {
    errors.push('motiveChain must be a non-empty string');
  }
  if (typeof json.timelineOutline !== 'string' || !json.timelineOutline) {
    errors.push('timelineOutline must be a non-empty string');
  }
  if (typeof json.truthSummary !== 'string' || !json.truthSummary) {
    errors.push('truthSummary must be a non-empty string');
  }

  if (!json.characterSkeleton || typeof json.characterSkeleton !== 'object') {
    errors.push('characterSkeleton must be an object');
  } else {
    if (!Array.isArray(json.characterSkeleton.nodes)) {
      errors.push('characterSkeleton.nodes must be an array');
    } else {
      if (json.characterSkeleton.nodes.length !== players) {
        errors.push(`characterSkeleton.nodes length must be ${players}`);
      }
      const nodeNames = json.characterSkeleton.nodes.map((node) => node.name);
      if (!nodeNames.includes(json.murdererName)) {
        errors.push(`murdererName "${json.murdererName}" is not in characterSkeleton.nodes`);
      }
    }
    if (!Array.isArray(json.characterSkeleton.edges)) {
      errors.push('characterSkeleton.edges must be an array');
    }
  }

  if (!Array.isArray(json.foreshadowingPlan)) {
    errors.push('foreshadowingPlan must be an array');
  } else {
    json.foreshadowingPlan.forEach((item, index) => {
      if (item.payoffAct < item.plantAct) {
        errors.push(`foreshadowingPlan[${index}].payoffAct must be >= plantAct`);
      }
    });
  }

  return errors;
}

function buildMockStoryBible(params: ScriptGenerationParams): StoryBibleJson {
  const names = ['林少衡', '苏晚晴', '周知远', '许曼', '陈泊舟', '顾明岚', '沈砚'];
  const nodes = Array.from({ length: params.players }, (_, index) => ({
    name: names[index] ?? `角色${index + 1}`,
    identity: index === 0 ? '旧案幸存者' : index === 1 ? '被害者亲属' : '受邀来客',
    secret:
      index === 0
        ? '曾在十年前篡改关键证词'
        : index === 1
          ? '暗中调查家族遗产流向'
          : '与当年的失踪案存在隐秘关联',
  }));

  const murdererName = nodes[0]?.name ?? '林少衡';

  return {
    murdererName,
    murderMethod: '利用停电后的三分钟时间差，借预先布置的机关制造不在场证明。',
    coreTrick: '所有人以为钟声来自大厅，其实声音由书房录音延迟播放，误导了死亡时间。',
    motiveChain: `${murdererName}因旧案真相即将曝光而被逼入绝境，选择在聚会中清除唯一知情者。`,
    characterSkeleton: {
      nodes,
      edges: nodes.slice(1).map((node, index) => ({
        from: murdererName,
        to: node.name,
        type: index % 2 === 0 ? 'enemy' : 'conspiracy',
        label: index % 2 === 0 ? '旧怨未清' : '共同隐瞒',
        isHidden: true,
      })),
    },
    timelineOutline:
      '第一幕建立暴雨山庄与旧案阴影；第二幕通过停电、钟声和证词冲突制造时间线谜团；第三幕回收录音机关与证词漏洞，揭示真实死亡时间。',
    truthSummary:
      '凶手提前布置录音与机关，在众人视线被停电转移时完成作案，并用延迟钟声重塑所有人的时间记忆。',
    foreshadowingPlan: [
      {
        id: 'f-1',
        description: '大厅老钟偶尔慢三分钟',
        plantAct: 1,
        payoffAct: 3,
      },
      {
        id: 'f-2',
        description: '书房录音机被误认为装饰品',
        plantAct: 1,
        payoffAct: 3,
      },
      {
        id: 'f-3',
        description: '凶手对停电路线异常熟悉',
        plantAct: 2,
        payoffAct: 3,
      },
    ],
  };
}

async function persistStoryBible(
  scriptId: string,
  params: ScriptGenerationParams,
  json: StoryBibleJson,
  startedAt: Date,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: upsertedData, error: upsertError } = await supabase
    .from('story_bibles')
    .upsert(
      {
        script_id: scriptId,
        murderer_character_name: json.murdererName,
        murder_method: json.murderMethod,
        core_trick: json.coreTrick,
        motive_chain: json.motiveChain,
        character_skeleton: json.characterSkeleton,
        timeline_outline: json.timelineOutline,
        truth_summary: json.truthSummary,
        foreshadowing_plan: json.foreshadowingPlan,
        confirmed: false,
      },
      { onConflict: 'script_id' },
    )
    .select('id')
    .single();

  if (upsertError) {
    const missingStoryBibleTable =
      upsertError.code === 'PGRST205' ||
      upsertError.message.includes("Could not find the table 'public.story_bibles'");

    if (missingStoryBibleTable) {
      console.warn(
        'story_bibles table is missing; returning story bible without persistence. Run supabase migrations to enable resume/gate persistence.',
      );
      return null;
    }

    throw new Error(`Story bible upsert failed: ${upsertError.message}`);
  }

  const storyBibleId = upsertedData?.id as string;
  const { error: taskError } = await supabase.from('generation_tasks').insert({
    script_id: scriptId,
    task_type: 'STORY_BIBLE',
    status: 'completed',
    params,
    progress_percent: 100,
    result_data: { storyBibleId },
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (taskError) {
    console.warn(`Generation task insert failed; continuing without task record: ${taskError.message}`);
  }

  return storyBibleId;
}

function buildMockCharacterProfiles(storyBible: StoryBibleJson): CharacterProfilesJson {
  return {
    characters: storyBible.characterSkeleton.nodes.map((node, index) => ({
      name: node.name,
      roleIdentity: node.identity,
      gender: index % 3 === 0 ? 'male' : index % 3 === 1 ? 'female' : 'unknown',
      age: 24 + index * 4,
      personality: index === 0 ? '克制、敏锐、习惯掌控局面' : '外热内冷，擅长隐藏真实情绪',
      backgroundStory: `${node.name}与旧案存在牵连，表面身份是${node.identity}，真实秘密是：${node.secret}`,
      personalTask: index === 0 ? '掩盖旧案证据并转移众人怀疑' : '查清聚会背后的真实目的',
      isMurderer: node.name === storyBible.murdererName,
      secretFromBible: node.secret,
    })),
  };
}

function buildMockActStructure(params: ScriptGenerationParams, storyBible: StoryBibleJson): ActStructureJson {
  const actCount = Math.min(5, Math.max(3, Math.ceil(params.duration / 1.5)));
  return {
    acts: Array.from({ length: actCount }, (_, index) => {
      const sortOrder = index + 1;
      return {
        title:
          sortOrder === 1
            ? '第一幕 · 旧镇邀约'
            : sortOrder === actCount
              ? `第${sortOrder}幕 · 真相回声`
              : `第${sortOrder}幕 · 疑云加深`,
        sortOrder,
        content:
          sortOrder === 1
            ? `众人因${params.title}聚集，${storyBible.coreTrick}的第一处伏笔被埋下。`
            : sortOrder === actCount
              ? `回收${storyBible.murderMethod}与关键证词，揭开${storyBible.murdererName}的动机链。`
              : '玩家通过证词冲突、地点搜证和人物秘密逐步逼近死亡时间真相。',
        scenes: [
          {
            title: sortOrder === 1 ? '抵达古镇' : `搜证现场 ${sortOrder}`,
            location: sortOrder === 1 ? '古镇客栈' : ['祠堂', '书房', '码头', '药铺'][index % 4],
            content: '玩家收集证词，发现时间线与人物陈述存在细微矛盾。',
            sortOrder: 1,
          },
          {
            title: sortOrder === actCount ? '终局复盘' : `秘密交锋 ${sortOrder}`,
            location: sortOrder === actCount ? '旧钟楼' : ['后院', '档案室', '茶室', '暗巷'][index % 4],
            content: '关键人物暴露隐藏关系，新的线索指向旧案真相。',
            sortOrder: 2,
          },
        ],
        searchRounds: [
          {
            round: sortOrder,
            locations: ['古镇客栈', '旧钟楼', '祠堂'].slice(0, sortOrder === 1 ? 2 : 3),
          },
        ],
      };
    }),
  };
}

async function persistCharacterProfiles(
  scriptId: string,
  params: ScriptGenerationParams,
  json: CharacterProfilesJson,
): Promise<void> {
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from('characters').delete().eq('script_id', scriptId);
  if (deleteError) {
    console.warn(`Character cleanup failed; continuing without persistence: ${deleteError.message}`);
    return;
  }

  const { error: insertError } = await supabase.from('characters').insert(
    json.characters.map((character, index) => ({
      script_id: scriptId,
      name: character.name,
      role_identity: character.roleIdentity,
      gender: character.gender,
      age: character.age,
      personality: character.personality,
      background_story: character.backgroundStory,
      personal_task: character.personalTask,
      is_murderer: character.isMurderer,
      sort_order: index,
    })),
  );
  if (insertError) {
    console.warn(`Character insert failed; continuing without persistence: ${insertError.message}`);
    return;
  }

  const { error: taskError } = await supabase.from('generation_tasks').insert({
    script_id: scriptId,
    task_type: 'CHARACTER_PROFILES',
    status: 'completed',
    params,
    progress_percent: 100,
    result_data: { characterCount: json.characters.length },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  if (taskError) console.warn(`Character task insert failed; continuing: ${taskError.message}`);
}

async function persistActStructure(
  scriptId: string,
  params: ScriptGenerationParams,
  json: ActStructureJson,
): Promise<number> {
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from('acts').delete().eq('script_id', scriptId);
  if (deleteError) {
    console.warn(`Act cleanup failed; continuing without persistence: ${deleteError.message}`);
    return json.acts.reduce((sum, act) => sum + act.scenes.length, 0);
  }

  let sceneCount = 0;
  for (const act of json.acts) {
    const { data: actData, error: actError } = await supabase
      .from('acts')
      .insert({
        script_id: scriptId,
        title: act.title,
        sort_order: act.sortOrder,
        content: act.content,
      })
      .select('id')
      .single();
    if (actError) {
      console.warn(`Act insert failed; continuing without persistence: ${actError.message}`);
      return json.acts.reduce((sum, currentAct) => sum + currentAct.scenes.length, 0);
    }

    const { error: sceneError } = await supabase.from('scenes').insert(
      act.scenes.map((scene) => ({
        act_id: actData.id,
        title: scene.title,
        location: scene.location,
        content: scene.content,
        sort_order: scene.sortOrder,
      })),
    );
    if (sceneError) {
      console.warn(`Scene insert failed; continuing without persistence: ${sceneError.message}`);
      return json.acts.reduce((sum, currentAct) => sum + currentAct.scenes.length, 0);
    }
    sceneCount += act.scenes.length;
  }

  const { error: taskError } = await supabase.from('generation_tasks').insert({
    script_id: scriptId,
    task_type: 'ACT_STRUCTURE',
    status: 'completed',
    params,
    progress_percent: 100,
    result_data: { actCount: json.acts.length, sceneCount },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  if (taskError) console.warn(`Act task insert failed; continuing: ${taskError.message}`);

  return sceneCount;
}

async function handleMockPhase(
  phase: 'character-profiles' | 'act-structure',
  body: GenerateRequestBody,
): Promise<Response> {
  const { scriptId, params } = body;
  const storyBible = buildMockStoryBible(params);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encodeSse(encoder, 'start', { scriptId, stage: `${phase}-init` }));

        if (phase === 'character-profiles') {
          const json = buildMockCharacterProfiles(storyBible);
          await persistCharacterProfiles(scriptId, params, json);
          controller.enqueue(encodeSse(encoder, 'progress', { percent: 100, stage: 'mock' }));
          controller.enqueue(
            encodeSse(encoder, 'completed', {
              scriptId,
              characterCount: json.characters.length,
              result: json,
            }),
          );
          return;
        }

        const json = buildMockActStructure(params, storyBible);
        const sceneCount = await persistActStructure(scriptId, params, json);
        controller.enqueue(encodeSse(encoder, 'progress', { percent: 100, stage: 'mock' }));
        controller.enqueue(
          encodeSse(encoder, 'completed', {
            scriptId,
            actCount: json.acts.length,
            sceneCount,
            result: json,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encodeSse(encoder, 'error', { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function handleGenericMockPhase(phase: string, body: GenerateRequestBody): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encodeSse(encoder, 'start', { scriptId: body.scriptId, stage: `${phase}-mock` }));
      controller.enqueue(encodeSse(encoder, 'progress', { percent: 100, stage: 'mock' }));
      controller.enqueue(
        encodeSse(encoder, 'completed', {
          scriptId: body.scriptId,
          result: { phase, mocked: true },
        }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function handleStoryBible(body: GenerateRequestBody): Promise<Response> {
  const { scriptId, params } = body;
  const { systemPrompt, userPrompt } = buildStoryBiblePrompt(params);
  const provider = new DeepSeekProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let accumulated = '';
      const startedAt = new Date();

      try {
        controller.enqueue(encodeSse(encoder, 'start', { scriptId, stage: 'story-bible-init' }));

        if (!process.env.DEEPSEEK_API_KEY) {
          const json = buildMockStoryBible(params);
          const storyBibleId = await persistStoryBible(scriptId, params, json, startedAt);
          controller.enqueue(encodeSse(encoder, 'progress', { percent: 100, stage: 'mock' }));
          controller.enqueue(
            encodeSse(encoder, 'completed', {
              scriptId,
              storyBibleId,
              result: json,
            }),
          );
          return;
        }

        for await (const chunk of provider.generateStream({
          prompt: userPrompt,
          systemPrompt,
          temperature: 0.6,
          onChunk: (content) => {
            accumulated += content;
          },
        })) {
          if (chunk.content) {
            controller.enqueue(encodeSse(encoder, 'chunk', { content: chunk.content }));
          }
          if (typeof chunk.progress === 'number') {
            controller.enqueue(
              encodeSse(encoder, 'progress', { percent: Math.round(chunk.progress * 100) }),
            );
          }
          if (chunk.done) break;
        }

        controller.enqueue(encodeSse(encoder, 'progress', { percent: 100, stage: 'parsing' }));
        const json = parseJSONWithTolerance<StoryBibleJson>(accumulated);
        const validationErrors = validateStoryBible(json, params.players);
        if (validationErrors.length > 0) {
          controller.enqueue(encodeSse(encoder, 'error', { message: validationErrors.join('; ') }));
          return;
        }

        const storyBibleId = await persistStoryBible(scriptId, params, json, startedAt);

        controller.enqueue(
          encodeSse(encoder, 'completed', {
            scriptId,
            storyBibleId,
            result: json,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encodeSse(encoder, 'error', { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ phase: string }> },
): Promise<Response> {
  if (!SUPABASE_URL) {
    return buildError('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  const { phase } = await context.params;
  if (phase === 'story-bible') {
    const body: unknown = await request.json().catch(() => null);
    if (!validateBody(body)) {
      return buildError('Invalid parameters', 400);
    }
    return handleStoryBible(body);
  }

  if (phase === 'character-profiles' || phase === 'act-structure') {
    const body: unknown = await request.json().catch(() => null);
    if (!validateBody(body)) {
      return buildError('Invalid parameters', 400);
    }
    return handleMockPhase(phase, body);
  }

  if (
    phase === 'character-script' ||
    phase === 'clues' ||
    phase === 'organizer-manual' ||
    phase === 'truth-review'
  ) {
    const body: unknown = await request.json().catch(() => null);
    if (!validateBody(body)) {
      return buildError('Invalid parameters', 400);
    }
    return handleGenericMockPhase(phase, body);
  }

  const authorization = request.headers.get('authorization');
  const apikey = request.headers.get('apikey') ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!authorization) {
    return buildError('Missing authorization header', 401);
  }

  if (!apikey) {
    return buildError('Missing Supabase anon key', 500);
  }

  const upstream = await fetch(`${SUPABASE_URL}/functions/v1/generate/${phase}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey,
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      Accept: request.headers.get('accept') ?? 'text/event-stream',
    },
    body: request.body,
    duplex: 'half',
  } as RequestInit);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
      'Cache-Control': upstream.headers.get('cache-control') ?? 'no-cache, no-transform',
    },
  });
}
