-- 叙光 (NarrLight) - 创作点计费与质量状态
-- 迁移版本: 014_credit_billing
-- 创建日期: 2026-07-21
-- 说明: 新增创作点账户与流水，并为 generation_tasks 预留质量/重试/扣费字段。

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 30 CHECK (balance >= 0),
  monthly_grant INTEGER NOT NULL DEFAULT 30 CHECK (monthly_grant >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.generation_tasks(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  type VARCHAR(20) NOT NULL CHECK (type IN ('grant','consume','refund','adjustment')),
  reason VARCHAR(100) NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_task
  ON public.credit_transactions(task_id);

ALTER TABLE public.generation_tasks
  ADD COLUMN IF NOT EXISTS quality_status VARCHAR(20) NOT NULL DEFAULT 'unchecked'
    CHECK (quality_status IN ('unchecked','passed','failed','disputed','refunded')),
  ADD COLUMN IF NOT EXISTS retry_of_task_id UUID REFERENCES public.generation_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 1 CHECK (max_retries >= 0),
  ADD COLUMN IF NOT EXISTS charged_credits INTEGER NOT NULL DEFAULT 0 CHECK (charged_credits >= 0),
  ADD COLUMN IF NOT EXISTS refund_credits INTEGER NOT NULL DEFAULT 0 CHECK (refund_credits >= 0),
  ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_feedback TEXT DEFAULT NULL;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_credits_select" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credit_transactions_select" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
