/* eslint-disable react/jsx-key */
import { AdminTable, PageHeader, RowActions, Tag, Toolbar } from "@/components/admin-static";

export default function ModerationPage() {
  return (
    <div className="page-stack">
      <PageHeader title="社区审核" description="处理内容举报、用户申诉及社区违规内容。" />
      <section className="tabs" aria-label="审核分类">
        <button className="tab active" type="button">举报队列 8</button>
        <button className="tab" type="button">内容巡检</button>
        <button className="tab" type="button">申诉 2</button>
      </section>
      <div className="admin-card">
        <Toolbar search="搜索举报编号或内容" filters={["待处理", "全部类型"]} />
        <AdminTable
          headers={["举报内容", "类型", "举报原因", "举报人", "提交时间", "状态", "操作"]}
          total="共 284 条"
          rows={[
            ["“全网独家剧本资源低价出售...”", "帖子", <Tag tone="error">侵权盗版</Tag>, "青山客", "32 分钟前", <Tag tone="warning">待处理</Tag>, <RowActions actions={[{ label: "开始处理" }]} />],
            ["“你这种水平也配写本？”", "评论", <Tag tone="warning">人身攻击</Tag>, "七月", "2 小时前", <Tag tone="info">处理中</Tag>, <RowActions actions={[{ label: "继续处理" }]} />],
            ["用户：搬运工007", "用户", <Tag tone="error">批量搬运</Tag>, "多人举报", "昨天 21:17", <Tag tone="warning">待处理</Tag>, <RowActions actions={[{ label: "开始处理" }]} />],
          ]}
        />
      </div>
    </div>
  );
}
