/* eslint-disable react/jsx-key */
import { AdminTable, DetailPreview, ExportButton, PageHeader, RowActions, Tag, Toolbar } from "@/components/admin-static";

export default function AuditPage() {
  return (
    <div className="page-stack">
      <PageHeader title="审计日志" description="追踪管理员的敏感操作与配置变更，日志不可修改。" actions={<ExportButton />} />
      <div className="content-grid">
        <div className="admin-card">
          <Toolbar search="搜索目标、管理员或操作" filters={["全部操作", "最近 7 天"]} />
          <AdminTable
            headers={["时间", "管理员", "操作", "目标", "原因", "IP", "详情"]}
            total="共 8,420 条"
            rows={[
              ["2026-07-20 10:31:22", "admin@narrlight.com", <Tag tone="error">内容下架</Tag>, "帖子 POST-8821", "确认存在盗版资源交易", "10.24.8.16", <RowActions actions={[{ label: "查看 Diff" }]} />],
              ["2026-07-20 09:42:08", "admin@narrlight.com", <Tag tone="info">配额调整</Tag>, "用户 USR-71182", "客服工单补偿 +10", "10.24.8.16", <RowActions actions={[{ label: "查看详情" }]} />],
              ["2026-07-19 18:24:51", "admin@narrlight.com", <Tag tone="purple">配置变更</Tag>, "ai.deepseek.timeout", "高峰时段降低超时失败", "10.24.8.16", <RowActions actions={[{ label: "查看 Diff" }]} />],
              ["2026-07-19 16:03:12", "admin@narrlight.com", <Tag tone="success">剧本通过</Tag>, "剧本 SCR-51A09C", "内容审核通过", "10.24.8.16", <RowActions actions={[{ label: "查看详情" }]} />],
            ]}
          />
        </div>
        <DetailPreview
          title="审计详情"
          rows={[
            ["管理员", "admin@narrlight.com"],
            ["操作", <Tag tone="error">内容下架</Tag>],
            ["目标", "帖子 POST-8821"],
            ["原因", "确认存在盗版资源交易"],
            ["IP", "10.24.8.16"],
            ["时间", "2026-07-20 10:31:22"],
          ]}
        />
      </div>
    </div>
  );
}
