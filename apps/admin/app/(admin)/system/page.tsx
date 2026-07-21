import { ConfigCard, PageHeader, SaveButton } from "@/components/admin-static";

export default function SystemPage() {
  return (
    <div className="page-stack">
      <PageHeader title="系统配置" description="管理 AI 提供商、默认配额及内容安全策略。保存时必须填写变更原因。" actions={<SaveButton />} />
      <div className="config-grid">
        <ConfigCard logo="DS" name="DeepSeek" desc="剧本生成主模型" fields={[["模型", "deepseek-chat"], ["API Key", "sk-••••••••••••9d2a"], ["请求超时（秒）", "120"]]} />
        <ConfigCard logo="GLM" name="智谱 GLM" desc="备用文本生成模型" fields={[["模型", "glm-4-plus"], ["API Key", "••••••••••••••3f01"], ["最大重试次数", "3"]]} />
        <ConfigCard logo="OI" name="OpenAI Image" desc="插画生成模型" fields={[["模型", "gpt-image-1"], ["API Key", "sk-proj-••••••••••••"], ["默认质量", "high"]]} />
        <ConfigCard logo="SD" name="Seedream" desc="插画备用模型" enabled={false} fields={[["模型", "seedream-3.0"], ["API Key", "••••••••••••••••"], ["最大重试次数", "2"]]} />
      </div>
    </div>
  );
}
