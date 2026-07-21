-- Prepare admin_users for future local multi-admin account management.
-- 016 may already be applied in deployed databases, so account-login fields
-- are added in this follow-up migration instead of changing 016 in place.

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_id_fkey;

ALTER TABLE public.admin_users
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS username VARCHAR(80),
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username
  ON public.admin_users(username)
  WHERE username IS NOT NULL;

COMMENT ON TABLE public.admin_users IS
  'Reserved admin account table. Current MVP uses fixed cookie login; future Admin account management can use local username/password_hash accounts with super_admin as the first role.';

COMMENT ON COLUMN public.admin_users.password_hash IS
  'Reserved for future local admin login. Store a password hash only, never plaintext.';
