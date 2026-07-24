-- 为文本生成 provider 配置补充 Kimi。
-- API Key 仍通过 KIMI_API_KEY 环境变量提供，不写入 system_configs。

update public.system_configs
set
  value = jsonb_set(
    jsonb_set(
      value,
      '{providers,kimi}',
      '{"enabled": true, "model": "kimi-k3", "timeout": 180, "retries": 2}'::jsonb,
      true
    ),
    '{fallback}',
    coalesce(value->'fallback', 'null'::jsonb),
    true
  ),
  updated_at = now()
where key = 'text_provider'
  and value #> '{providers,kimi}' is null;
