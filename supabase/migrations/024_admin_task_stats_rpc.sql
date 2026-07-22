-- admin 端任务列表 stats 聚合 RPC
-- 背景：原 generation-tasks.ts 中 buildStats 用 4 次独立查询 + 1 次内存求和，
-- illustration-tasks.ts 中 composeStats 直接 reduce 当前页（20 条）数据，
-- 数据量大时低效且统计不准。此处新增 RPC 一次 SQL 聚合返回所有指标。
-- 安全：使用 security definer 让 admin service role 绕过 RLS 读取全表统计；
--       参数化过滤避免 SQL 注入；无任何写操作。

create or replace function public.admin_get_generation_task_stats(
  p_task_type text default null,
  p_script_id uuid default null,
  p_q text default null,
  p_matched_script_ids uuid[] default null
) returns table(running bigint, completed bigint, failed bigint, charged_credits bigint) as $$
  select
    count(*) filter (where status = 'running'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed'),
    coalesce(sum(charged_credits), 0)::bigint
  from public.generation_tasks
  where (p_task_type is null or task_type = p_task_type)
    and (p_script_id is null or script_id = p_script_id)
    and (
      p_q is null or
      task_type ilike '%' || p_q || '%' or
      id::text = p_q or
      script_id::text = p_q or
      (p_matched_script_ids is not null and script_id = any(p_matched_script_ids))
    );
$$ language sql security definer stable;

create or replace function public.admin_get_illustration_task_stats(
  p_task_type text default null,
  p_quality_status text default null,
  p_selected_model text default null,
  p_q text default null,
  p_matched_script_ids uuid[] default null
) returns table(running bigint, completed bigint, unchecked bigint, failed bigint) as $$
  select
    count(*) filter (where status in ('running', 'pending')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where quality_status = 'unchecked' or quality_status is null),
    count(*) filter (where status = 'failed')
  from public.illustration_tasks
  where (p_task_type is null or task_type = p_task_type)
    and (p_quality_status is null or quality_status = p_quality_status)
    and (p_selected_model is null or selected_model = p_selected_model)
    and (
      p_q is null or
      title ilike '%' || p_q || '%' or
      task_type ilike '%' || p_q || '%' or
      selected_model ilike '%' || p_q || '%' or
      id::text = p_q or
      script_id::text = p_q or
      (p_matched_script_ids is not null and script_id = any(p_matched_script_ids))
    );
$$ language sql security definer stable;
