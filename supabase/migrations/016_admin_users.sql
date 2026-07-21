-- Admin whitelist table reserved for the independent apps/admin application.
-- Current MVP login uses one fixed super-admin account in apps/admin.
-- This table is kept for the next phase, when multiple admin accounts are
-- managed from the Admin system itself.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(200) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'super_admin'
    CHECK (role IN ('super_admin', 'operator', 'reviewer', 'support')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_self_read" ON public.admin_users;
CREATE POLICY "admin_users_self_read" ON public.admin_users
  FOR SELECT
  USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);
