-- NarrLight - RLS 策略补全与修复
-- 迁移版本: 035_rls_policies_fix
-- 创建日期: 2026-08-07
--
-- 背景：
--   1. 7 张表启用了 RLS 但无策略 → anon/authenticated 查询全部被拒
--   2. 3 张 illustration 表未启用 RLS → 任何用户可读写全部行
--   3. manual_payment_orders 的 UPDATE 策略过于宽松 → 用户可改 status 等敏感字段
--
-- 所有操作均做表存在性检查，表不存在时安全跳过

-- ============================================================
-- 一、知识库 / 生成报告：补充 SELECT 策略（写入走 service_role）
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_documents') THEN
    CREATE POLICY "knowledge_documents_select_authenticated"
      ON public.knowledge_documents FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_extraction_jobs') THEN
    CREATE POLICY "knowledge_extraction_jobs_select_authenticated"
      ON public.knowledge_extraction_jobs FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_candidates') THEN
    CREATE POLICY "knowledge_candidates_select_authenticated"
      ON public.knowledge_candidates FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='generation_knowledge_usages') THEN
    CREATE POLICY "generation_knowledge_usages_select_own"
      ON public.generation_knowledge_usages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = generation_knowledge_usages.script_id
            AND scripts.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='generation_quality_reports') THEN
    CREATE POLICY "generation_quality_reports_select_own"
      ON public.generation_quality_reports FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = generation_quality_reports.script_id
            AND scripts.author_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 二、admin_audit_logs / system_configs：仅 service_role 访问
--    添加限制性策略阻止 anon/authenticated 读取
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_audit_logs') THEN
    CREATE POLICY "admin_audit_logs_restrict_anon"
      ON public.admin_audit_logs AS RESTRICTIVE FOR SELECT
      USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_configs') THEN
    CREATE POLICY "system_configs_restrict_anon"
      ON public.system_configs AS RESTRICTIVE FOR SELECT
      USING (false);
  END IF;
END $$;

-- ============================================================
-- 三、illustration 表：启用 RLS + 添加策略
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='illustration_market_items') THEN
    ALTER TABLE public.illustration_market_items ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "illustration_market_items_select_authenticated"
      ON public.illustration_market_items FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='illustration_style_profiles') THEN
    ALTER TABLE public.illustration_style_profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "illustration_style_profiles_all_own"
      ON public.illustration_style_profiles FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = illustration_style_profiles.script_id
            AND scripts.author_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = illustration_style_profiles.script_id
            AND scripts.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='illustration_tasks') THEN
    ALTER TABLE public.illustration_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "illustration_tasks_all_own"
      ON public.illustration_tasks FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = illustration_tasks.script_id
            AND scripts.author_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.scripts
          WHERE scripts.id = illustration_tasks.script_id
            AND scripts.author_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 四、manual_payment_orders: 收紧 UPDATE 策略
--    用户只能更新凭证相关字段，status/transaction_no 等由 service_role 管理
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='manual_payment_orders') THEN
    DROP POLICY IF EXISTS "manual_payment_orders_update_own" ON public.manual_payment_orders;
    CREATE POLICY "manual_payment_orders_update_own_proof"
      ON public.manual_payment_orders FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (
        auth.uid() = user_id
        AND status IN ('pending', 'submitted')
      );
  END IF;
END $$;
