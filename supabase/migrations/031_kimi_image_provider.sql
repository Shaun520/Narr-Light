-- 为插画生成 provider 配置补充 Kimi（图像模型 kimi-m3）。
-- API Key 复用剧本生成的 KIMI_API_KEY / KSPMAS_API_KEY / MOONSHOT_API_KEY 环境变量，不写入 system_configs。

update public.system_configs
set
  value = jsonb_set(
    value,
    '{providers,kimi}',
    '{"enabled": true, "model": "kimi-m3", "size": "1024x1024", "timeout": 60, "retries": 3}'::jsonb,
    true
  ),
  updated_at = now()
where key = 'image_provider'
  and value #> '{providers,kimi}' is null;
