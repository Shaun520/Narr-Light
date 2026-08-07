-- 036_atomic_replace_generation.sql
-- 目的: 将生成阶段 Edge Function 的"清空旧数据 + 插入新数据"封装为数据库内事务，
--       避免 delete 成功但 insert 失败时产生中间态数据（部分覆盖/空数据）。
-- 覆盖三处非原子的"先删后插"写入：
--   - act-structure  (public.acts + public.scenes，scenes 级联删除)
--   - character-profiles (public.characters)
--   - clues（public.clues）
-- 安全: security definer 以函数 owner 执行，search_path 固定 public，全部参数化。
-- 每个函数在单一 SQL 事务内执行（PL/pgSQL 函数体隐式事务）。

-- ============================================================
-- 1. 分幕结构 + 场景替换
--    级联删除旧 acts（scenes 通过外键 ON DELETE CASCADE 自动删除），
--    然后逐幕插入 acts 并连同其 scenes 一并重建，全部在一个事务中完成。
--
-- 说明: 原 Edge 代码在 scenes 表中使用 act_id 外键，须先插入 act 拿到新 id，
--       故使用 PL/pgSQL 循环。循环内所有语句都在同一事务内，任一步失败整体回滚。
-- ============================================================
create or replace function public.narr_replace_act_structure(
  p_script_id uuid,
  p_acts jsonb
) returns void as $$
declare
  rec jsonb;
  new_act_id uuid;
begin
  delete from public.acts where script_id = p_script_id;

  if p_acts is null or jsonb_typeof(p_acts) <> 'array' then
    return;
  end if;

  for rec in select value from jsonb_array_elements(p_acts) loop
    insert into public.acts (script_id, title, sort_order, content)
    values (
      p_script_id,
      coalesce(rec->>'title', ''),
      coalesce((rec->>'sortOrder')::int, 0),
      coalesce(rec->>'content', '')
    )
    returning id into new_act_id;

    if jsonb_typeof(rec->'scenes') = 'array' and jsonb_array_length(rec->'scenes') > 0 then
      insert into public.scenes (act_id, title, location, content, sort_order)
      select
        new_act_id,
        coalesce(s->>'title', ''),
        coalesce(s->>'location', ''),
        coalesce(s->>'content', ''),
        coalesce((s->>'sortOrder')::int, 0)
      from jsonb_array_elements(rec->'scenes') as s;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 2. 人物表替换（清空旧人物 + 插入新人物）
-- ============================================================
create or replace function public.narr_replace_characters(
  p_script_id uuid,
  p_characters jsonb
) returns void as $$
begin
  delete from public.characters where script_id = p_script_id;

  if p_characters is null or jsonb_typeof(p_characters) <> 'array' then
    return;
  end if;

  insert into public.characters (
    script_id, name, role_identity, gender, age, personality,
    background_story, personal_task, is_murderer, sort_order
  )
  select
    p_script_id,
    coalesce(c->>'name', ''),
    coalesce(c->>'roleIdentity', ''),
    coalesce(c->>'gender', ''),
    nullif(c->>'age', '')::int,
    coalesce(c->>'personality', ''),
    coalesce(c->>'backgroundStory', ''),
    coalesce(c->>'personalTask', ''),
    coalesce((c->>'isMurderer')::boolean, false),
    (row_number() over ()) - 1
  from jsonb_array_elements(p_characters) as c;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 3. 线索卡替换（清空旧线索 + 插入新线索）
--    注意: 原 Edge 代码插入 related_character_names 列，但该列在当前
--    schema 中不存在（线索关联人物用 related_character_ids UUID[]），
--    故此处按现有 schema 只写入存在的列，避免 insert 直接失败。
-- ============================================================
create or replace function public.narr_replace_clues(
  p_script_id uuid,
  p_clues jsonb
) returns void as $$
begin
  delete from public.clues where script_id = p_script_id;

  if p_clues is null or jsonb_typeof(p_clues) <> 'array' then
    return;
  end if;

  insert into public.clues (
    script_id, title, content, clue_type, search_round, location,
    is_distractor, is_key_clue, unlock_condition, sort_order
  )
  select
    p_script_id,
    coalesce(c->>'title', ''),
    coalesce(c->>'content', ''),
    coalesce(c->>'clueType', ''),
    coalesce((c->>'searchRound')::int, 1),
    coalesce(c->>'location', ''),
    coalesce((c->>'isDistractor')::boolean, false),
    coalesce((c->>'isKeyClue')::boolean, false),
    coalesce(c->>'unlockCondition', ''),
    (row_number() over ()) - 1
  from jsonb_array_elements(p_clues) as c;
end;
$$ language plpgsql security definer set search_path = public;