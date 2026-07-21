/* eslint-disable react/jsx-key */
import { AdminTable, DetailPreview, PageHeader, RefreshButton, RowActions, StatGrid, Tag, Toolbar } from "@/components/admin-static";

export default function GenerationTasksPage() {
  return (
    <div className="page-stack">
      <PageHeader title="生成任务监控" description="统一监控剧本生成任务的运行状态。" actions={<RefreshButton />} />
      <StatGrid
        items={[
          { label: "运行中", value: "24", trend: "并发占用 24 / 50", tone: "info" },
          { label: "今日成功", value: "438", trend: "成功率 96.4%", tone: "success" },
          { label: "今日失败", value: "3", trend: "2 项可重试", tone: "error" },
          { label: "平均耗时", value: "08:42", trend: "较昨日降低 11%", tone: "warning" },
        ]}
      />
      <div className="content-grid">
        <div className="admin-card">
          <Toolbar search="搜索任务 ID、剧本或用户" filters={["全部状态", "全部阶段"]} />
          <AdminTable
            headers={["任务 / 剧本", "类型", "状态", "进度", "开始时间", "耗时", "Provider", "操作"]}
            total="共 18,204 条"
            rows={[
              ["TSK-88420 / 归雁书", <Tag tone="info">CHARACTER_SCRIPT</Tag>, <Tag tone="info">运行中</Tag>, "68%", "10:24:18", "06:42", "DeepSeek", <RowActions actions={[{ label: "详情" }, { label: "取消", danger: true }]} />],
              ["TSK-88416 / 纸鸢", <Tag tone="purple">TIMELINE_STRUCTURE</Tag>, <Tag tone="error">失败</Tag>, "35%", "09:56:03", "12:08", "DeepSeek", <RowActions actions={[{ label: "详情" }, { label: "重试" }]} />],
              ["TSK-88403 / 古镇雨夜", <Tag tone="success">STORY_BIBLE</Tag>, <Tag tone="success">已完成</Tag>, "100%", "08:14:36", "18:24", "GLM", <RowActions actions={[{ label: "详情" }]} />],
            ]}
          />
        </div>
        <DetailPreview
          title="任务详情"
          rows={[
            ["任务 ID", "TSK-88416"],
            ["任务类型", <Tag tone="info">CHARACTER_SCRIPT</Tag>],
            ["状态", <Tag tone="error">失败</Tag>],
            ["失败原因", "DeepSeek 请求超时（504 Gateway Timeout）"],
            ["Provider", <Tag tone="info">DeepSeek</Tag>],
            ["重试次数", "1 / 3"],
          ]}
        />
      </div>
    </div>
  );
}
