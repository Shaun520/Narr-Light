/* eslint-disable react/jsx-key */
import {
  AdminTable,
  DetailPreview,
  PageHeader,
  RowActions,
  Tag,
  Toolbar,
  UserCell,
} from "@/components/admin-static";

export default function UsersPage() {
  return (
    <div className="page-stack">
      <PageHeader title="用户管理" description="平台全部注册用户" />
      <div className="content-grid">
        <div className="admin-card">
          <Toolbar search="搜索邮箱 / 昵称 / ID" filters={["全部套餐", "全部状态"]} />
          <AdminTable
            headers={["用户 ID", "昵称", "邮箱", "套餐", "配额使用", "剧本数", "注册时间", "状态", "操作"]}
            total="共 12,842 条"
            rows={[
              [
                "a3f9c1e2...",
                <UserCell avatar="沈" name="沈墨白" sub="已认证" />,
                "shen.mobai@example.com",
                <Tag tone="purple">Pro</Tag>,
                "— / 无限",
                "4",
                "2026-06-22 14:32",
                <Tag tone="success">正常</Tag>,
                <RowActions actions={[{ label: "详情" }, { label: "配额" }, { label: "封禁", danger: true }]} />,
              ],
              [
                "b7e2d4f8...",
                <UserCell avatar="苏" name="苏沐" />,
                "su.mu@example.com",
                <Tag>免费版</Tag>,
                "7 / 10",
                "2",
                "2026-07-01 09:15",
                <Tag tone="success">正常</Tag>,
                <RowActions actions={[{ label: "详情" }, { label: "配额" }, { label: "封禁", danger: true }]} />,
              ],
              [
                "c1a8f3b9...",
                <UserCell avatar="陈" name="陈一鸣" />,
                "chen.yiming@example.com",
                <Tag>免费版</Tag>,
                "10 / 10",
                "1",
                "2026-07-05 16:48",
                <Tag tone="error">已封禁</Tag>,
                <RowActions actions={[{ label: "详情" }, { label: "配额" }, { label: "解封" }]} />,
              ],
              [
                "d9c4e2a1...",
                <UserCell avatar="夜" name="夜行者" />,
                "nightwalker@example.com",
                <Tag tone="purple">Pro</Tag>,
                "— / 无限",
                "5",
                "2026-06-30 11:22",
                <Tag tone="success">正常</Tag>,
                <RowActions actions={[{ label: "详情" }, { label: "配额" }, { label: "封禁", danger: true }]} />,
              ],
            ]}
          />
        </div>
        <DetailPreview
          title="用户详情"
          rows={[
            ["用户 ID", "a3f9c1e2-8b5d-4f8a-9c1e-2a3b4c5d6e7f"],
            ["昵称", "沈墨白"],
            ["邮箱", "shen.mobai@example.com"],
            ["套餐", <Tag tone="purple">Pro</Tag>],
            ["配额", "— / 无限"],
            ["状态", <Tag tone="success">正常</Tag>],
            ["注册时间", "2026-06-22 14:32:18"],
            ["最近登录", "今天 10:22"],
          ]}
        />
      </div>
    </div>
  );
}
