import { Bars, Card, ExportButton, PageHeader, StatGrid, Tag } from "@/components/admin-static";

export default function AnalyticsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="数据看板"
        description="分析创作、用户与 AI 资源消耗趋势。"
        actions={
          <>
            <select className="select" defaultValue="最近 30 天">
              <option>最近 30 天</option>
              <option>最近 90 天</option>
            </select>
            <ExportButton />
          </>
        }
      />
      <StatGrid
        items={[
          { label: "月活用户", value: "8,904", trend: "↑ 14.2% 环比", tone: "info" },
          { label: "剧本完成率", value: "71.6%", trend: "↑ 3.8% 环比", tone: "success" },
          { label: "AI 估算成本", value: "¥12,806", trend: "单剧本 ¥3.34", tone: "warning" },
          { label: "内容审核通过率", value: "93.4%", trend: "待复审 8 个", tone: "purple" },
        ]}
      />
      <div className="dashboard-grid">
        <Card title="剧本题材分布" sub="按已完成剧本统计">
          <Bars
            items={[
              { label: "硬核", value: "386", height: 85, tone: "error" },
              { label: "情感", value: "318", height: 70, tone: "info" },
              { label: "恐怖", value: "204", height: 45, tone: "warning" },
              { label: "欢乐", value: "272", height: 60, tone: "success" },
              { label: "机制", value: "136", height: 30, tone: "purple" },
            ]}
          />
        </Card>
        <Card title="AI Provider 占比" sub="今日任务调用分布">
          <div className="rank-list">
            {[
              ["DeepSeek", "58%", "info"],
              ["GLM", "27%", "success"],
              ["OpenAI Image", "15%", "purple"],
            ].map(([name, value, tone]) => (
              <div className="rank-row" key={name}>
                <span>{name}</span>
                <div className="rank-bar"><span className={`rank-fill rank-${tone}`} style={{ width: value }} /></div>
                <Tag tone={tone as "info" | "success" | "purple"}>{value}</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
