-- 扩展 scripts.status CHECK 约束，新增审核流状态
-- 新增值：reviewing（审核中）/ approved（已通过）/ rejected（已驳回）/ taken_down（已下架）
-- 兼容原值：draft / generating / completed / archived
-- 背景：admin 端需要审核入口，对已完成剧本进行人工审核与上下架管理。

ALTER TABLE public.scripts
  DROP CONSTRAINT IF EXISTS scripts_status_check;

ALTER TABLE public.scripts
  ADD CONSTRAINT scripts_status_check
    CHECK (status IN (
      'draft',
      'generating',
      'completed',
      'archived',
      'reviewing',
      'approved',
      'rejected',
      'taken_down'
    ));
