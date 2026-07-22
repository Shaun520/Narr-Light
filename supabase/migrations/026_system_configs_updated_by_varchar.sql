-- 放宽 system_configs.updated_by 类型与约束
-- 背景：014_system_configs.sql 中 updated_by 定义为 uuid references auth.users(id)，
-- 但 admin 端写操作来自 admin_users 体系（admin.id 是字符串 "admin"），
-- 既不是 auth.users 中的真实用户，写入也会因外键约束失败被置为 null。
-- 此迁移把 updated_by 改为 VARCHAR(60)，去掉外键约束，
-- 让 admin 端可以把 admin.id 写入用于追溯。

ALTER TABLE public.system_configs
  DROP CONSTRAINT IF EXISTS system_configs_updated_by_fkey;

ALTER TABLE public.system_configs
  ALTER COLUMN updated_by TYPE VARCHAR(60) USING updated_by::text;

ALTER TABLE public.system_configs
  ALTER COLUMN updated_by DROP DEFAULT;
