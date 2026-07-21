/* eslint-disable react/jsx-key */
import { AdminTable, DetailPreview, ExportButton, FilterButton, PageHeader, RowActions, Tag, Toolbar } from "@/components/admin-static";

export default function ScriptsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="剧本管理"
        description="审核剧本内容、追踪生成状态并处理违规作品。"
        actions={
          <>
            <ExportButton />
            <FilterButton>审核队列</FilterButton>
          </>
        }
      />
      <div className="content-grid">
        <div className="admin-card">
          <Toolbar search="搜索剧本标题或作者" filters={["全部状态", "全部题材", "全部难度"]} />
          <AdminTable
            headers={["剧本标题", "作者", "题材", "难度", "字数", "状态", "更新时间", "操作"]}
            total="共 3,826 条"
            rows={[
              ["雾港夜话", "沈墨白", <Tag tone="info">情感</Tag>, <Tag>进阶</Tag>, "42,180", <Tag tone="warning">待审核</Tag>, "12 分钟前", <RowActions actions={[{ label: "查看" }, { label: "通过" }, { label: "驳回", danger: true }]} />],
              ["长夜无声", "墨客十三", <Tag tone="error">硬核</Tag>, <Tag tone="warning">烧脑</Tag>, "112,835", <Tag tone="success">已通过</Tag>, "今天 09:31", <RowActions actions={[{ label: "查看" }, { label: "下架", danger: true }]} />],
              ["玻璃房间", "叶青禾", <Tag tone="purple">恐怖</Tag>, <Tag>进阶</Tag>, "38,640", <Tag tone="error">已驳回</Tag>, "昨天 18:03", <RowActions actions={[{ label: "查看" }, { label: "复审" }]} />],
              ["机关城", "夜行者", <Tag tone="success">机制</Tag>, <Tag>进阶</Tag>, "76,420", <Tag tone="info">生成中</Tag>, "今天 08:42", <RowActions actions={[{ label: "查看任务" }]} />],
            ]}
          />
        </div>
        <DetailPreview
          title="剧本详情"
          rows={[
            ["剧本", "雾港夜话"],
            ["作者", "沈墨白"],
            ["题材 / 难度", <><Tag tone="info">情感</Tag> <Tag>进阶</Tag></>],
            ["玩家 / 时长", "6 人 · 4 小时"],
            ["字数", "42,180"],
            ["审核状态", <Tag tone="warning">待审核</Tag>],
            ["核心立意", "旧案重启，群像关系在真相逼近中被迫重组。"],
          ]}
        />
      </div>
    </div>
  );
}
