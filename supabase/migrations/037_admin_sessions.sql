-- 037_admin_sessions.sql
-- 目的: 将 admin 端从"静态字符串 cookie 认证"升级为真正的服务端会话。
--  - 登录成功后为每个会话生成随机 token，仅把 token 的 SHA-256 哈希存入
--    admin_sessions，cookie 中保存明文 token。
--  - 登出/吊销 = 置 revoked_at，会话立即失效（无需等 cookie 过期）。
--  - 依赖 016/017 的 admin_users 表（username / password_hash / role /
--    failed_login_count / locked_until_at / is_active）。

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
  ON public.admin_sessions(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
  ON public.admin_sessions(expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 会话表只允许通过 service role（绕过 RLS）或函数访问，禁止普通客户端直读。
DROP POLICY IF EXISTS "admin_sessions_no_anon" ON public.admin_sessions;
CREATE POLICY "admin_sessions_no_anon" ON public.admin_sessions
  FOR SELECT
  USING (false);
