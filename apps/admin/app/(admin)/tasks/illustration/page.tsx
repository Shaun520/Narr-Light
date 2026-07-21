/* eslint-disable react/jsx-key */
import { AdminTable, PageHeader, RefreshButton, RowActions, StatGrid, Tag, Toolbar } from "@/components/admin-static";

export default function IllustrationTasksPage() {
  return (
    <div className="page-stack">
      <PageHeader title="插画任务监控" description="统一监控插画任务的生成、质检和失败重试。" actions={<RefreshButton />} />
      <StatGrid
        items={[
          { label: "运行中", value: "12", trend: "OpenAI Image 8 项", tone: "info" },
          { label: "今日完成", value: "186", trend: "质量通过 91.2%", tone: "success" },
          { label: "待质检", value: "24", trend: "线索卡占比最高", tone: "warning" },
          { label: "今日失败", value: "5", trend: "3 项可重试", tone: "error" },
        ]}
      />
      <div className="admin-card">
        <Toolbar search="搜索任务、剧本或资源" filters={["全部状态", "全部类型", "全部模型"]} />
        <AdminTable
          headers={["任务 / 剧本", "类型", "模型", "比例", "状态", "质检", "更新时间", "操作"]}
          total="共 6,482 条"
          rows={[
            ["IMG-77021 / 雾港夜话", <Tag tone="purple">封面</Tag>, "OpenAI Image", "1024x1536", <Tag tone="info">运行中</Tag>, <Tag>未检查</Tag>, "3 分钟前", <RowActions actions={[{ label: "详情" }, { label: "取消", danger: true }]} />],
            ["IMG-77016 / 纸鸢", <Tag tone="info">场景</Tag>, "Seedream", "1536x1024", <Tag tone="error">失败</Tag>, <Tag tone="warning">警告</Tag>, "18 分钟前", <RowActions actions={[{ label: "详情" }, { label: "重试" }]} />],
            ["IMG-76988 / 古镇雨夜", <Tag tone="success">线索卡</Tag>, "OpenAI Image", "1024x1024", <Tag tone="success">已完成</Tag>, <Tag tone="success">通过</Tag>, "今天 09:31", <RowActions actions={[{ label: "预览" }]} />],
          ]}
        />
      </div>
    </div>
  );
}
