import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  relationExtractor,
  type ExistingRelationRow,
  type RelationEdge,
  type RelationGraphData,
  type RelationType,
} from '@/lib/services/relation-extractor';
import { createAdminClient } from '@/lib/supabase/admin';

type RelationRow = {
  id: string;
  source_character_id: string;
  target_character_id: string;
  relation_type: RelationType;
  label: string | null;
  is_visible: boolean;
  is_hidden_relation: boolean;
  hidden_label: string | null;
  created_at?: string;
};

type CharacterRow = {
  id: string;
  name: string;
  role_identity: string | null;
  gender: 'male' | 'female' | 'unknown' | '' | null;
  age: number | null;
  personality: string | null;
  background_story: string | null;
  personal_task: string | null;
  is_murderer: boolean | null;
  sort_order: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRelationType(value: unknown): value is RelationType {
  return (
    value === 'family' ||
    value === 'friend' ||
    value === 'lover' ||
    value === 'enemy' ||
    value === 'colleague' ||
    value === 'conspiracy' ||
    value === 'other'
  );
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toExistingRelation(row: RelationRow): ExistingRelationRow {
  return {
    id: row.id,
    source: row.source_character_id,
    target: row.target_character_id,
    relationType: row.relation_type,
    label: row.label ?? '',
    isVisible: row.is_visible,
    isHiddenRelation: row.is_hidden_relation,
    hiddenLabel: row.hidden_label ?? '',
  };
}

async function loadGraphData(
  supabase: SupabaseClient,
  scriptId: string,
): Promise<RelationGraphData | null> {
  const [scriptResult, charactersResult, relationsResult] = await Promise.all([
    supabase.from('scripts').select('id').eq('id', scriptId).maybeSingle(),
    supabase
      .from('characters')
      .select('id, name, role_identity, gender, age, personality, background_story, personal_task, is_murderer, sort_order')
      .eq('script_id', scriptId)
      .order('sort_order'),
    supabase
      .from('character_relations')
      .select('id, source_character_id, target_character_id, relation_type, label, is_visible, is_hidden_relation, hidden_label, created_at')
      .eq('script_id', scriptId)
      .order('created_at'),
  ]);

  if (scriptResult.error) throw new Error(`读取剧本失败: ${scriptResult.error.message}`);
  if (!scriptResult.data) return null;
  if (charactersResult.error) throw new Error(`读取人物失败: ${charactersResult.error.message}`);
  if (relationsResult.error) throw new Error(`读取人物关系失败: ${relationsResult.error.message}`);

  const characters = ((charactersResult.data ?? []) as CharacterRow[]).map((character) => ({
    id: character.id,
    name: character.name,
    roleIdentity: character.role_identity ?? '',
    gender: character.gender ?? '',
    age: character.age,
    personality: character.personality ?? '',
    backgroundStory: character.background_story ?? '',
    personalTask: character.personal_task ?? '',
    isMurderer: Boolean(character.is_murderer),
    sortOrder: character.sort_order ?? 0,
  }));

  const existingRelations = ((relationsResult.data ?? []) as RelationRow[]).map(toExistingRelation);
  return relationExtractor.extract({ characters, existingRelations });
}

function parseRelationBody(value: unknown): RelationEdge {
  if (!isRecord(value)) throw new Error('请求体格式不正确');
  if (!isRecord(value.edge)) throw new Error('缺少关系数据');

  const edge = value.edge;
  const source = normalizeText(edge.source);
  const target = normalizeText(edge.target);
  const relationType = edge.relationType;
  const isVisible = Boolean(edge.isVisible);
  const isHiddenRelation = Boolean(edge.isHiddenRelation);

  if (!source || !target) throw new Error('起点和终点不能为空');
  if (source === target) throw new Error('起点和终点不能相同');
  if (!isRelationType(relationType)) throw new Error('关系类型不合法');
  if (!isVisible && !isHiddenRelation) throw new Error('至少需要保留一条明线或暗线');

  return {
    id: normalizeText(edge.id),
    source,
    target,
    relationType,
    label: normalizeText(edge.label).slice(0, 100),
    hiddenLabel: normalizeText(edge.hiddenLabel).slice(0, 100),
    isVisible,
    isHiddenRelation,
    strength: edge.strength === 'strong' || edge.strength === 'fatal' ? edge.strength : 'medium',
  };
}

async function assertCharactersBelongToScript(
  supabase: SupabaseClient,
  scriptId: string,
  sourceId: string,
  targetId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('characters')
    .select('id')
    .eq('script_id', scriptId)
    .in('id', [sourceId, targetId]);
  if (error) throw new Error(`校验人物失败: ${error.message}`);
  if ((data ?? []).length !== 2) throw new Error('关系人物不属于当前剧本');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> },
) {
  const { scriptId } = await params;
  const supabase = createAdminClient() as unknown as SupabaseClient;

  try {
    const graphData = await loadGraphData(supabase, scriptId);
    if (!graphData) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    return NextResponse.json({ graphData });
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取人物关系失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scriptId: string }> },
) {
  const { scriptId } = await params;
  const supabase = createAdminClient() as unknown as SupabaseClient;

  try {
    const edge = parseRelationBody(await request.json());
    await assertCharactersBelongToScript(supabase, scriptId, edge.source, edge.target);

    const row = {
      script_id: scriptId,
      source_character_id: edge.source,
      target_character_id: edge.target,
      relation_type: edge.relationType,
      label: edge.label,
      is_visible: edge.isVisible,
      is_hidden_relation: edge.isHiddenRelation,
      hidden_label: edge.hiddenLabel,
    };

    const shouldUpdate = isUuid(edge.id);
    const query = shouldUpdate
      ? supabase
          .from('character_relations')
          .update(row)
          .eq('id', edge.id)
          .eq('script_id', scriptId)
          .select('id, source_character_id, target_character_id, relation_type, label, is_visible, is_hidden_relation, hidden_label')
          .maybeSingle()
      : supabase
          .from('character_relations')
          .insert(row)
          .select('id, source_character_id, target_character_id, relation_type, label, is_visible, is_hidden_relation, hidden_label')
          .maybeSingle();

    const { data, error } = await query;
    if (error) throw new Error(`保存人物关系失败: ${error.message}`);
    if (!data) throw new Error('人物关系不存在或无权修改');

    return NextResponse.json({ relation: toExistingRelation(data as RelationRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存人物关系失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ scriptId: string }> },
) {
  const { scriptId } = await params;
  const supabase = createAdminClient() as unknown as SupabaseClient;

  try {
    const body = await request.json();
    if (!isRecord(body)) throw new Error('请求体格式不正确');
    const relationId = normalizeText(body.relationId);
    if (!relationId) throw new Error('缺少关系 ID');

    const { error } = await supabase
      .from('character_relations')
      .delete()
      .eq('script_id', scriptId)
      .eq('id', relationId);
    if (error) throw new Error(`删除人物关系失败: ${error.message}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除人物关系失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
