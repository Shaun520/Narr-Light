-- Add user ban state for Admin user management.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_banned
  ON public.users(is_banned);
