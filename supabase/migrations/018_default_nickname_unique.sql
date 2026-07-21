-- Ensure generated default nicknames like "叙光 - 14563212" are not reused.
-- User-edited nicknames are not constrained by this index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_default_nickname_unique
  ON public.users(nickname)
  WHERE nickname ~ '^叙光 - [0-9]{8}$';
