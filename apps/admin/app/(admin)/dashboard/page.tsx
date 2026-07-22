import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import {
  getAdminDashboardData,
  type AdminDashboardHealthItem,
  type AdminDashboardStat,
  type AdminDashboardTodo,
  type AdminDashboardTrendPoint,
} from "@/lib/services/dashboard";

const statIcons = {
  今日新增用户: Users,
  今日生成任务: Zap,
  活跃剧本: FileText,
  待审核举报: AlertTriangle,
  "AI 调用量": Bot,
};

export default async function DashboardPage() {
  const dashboard = await getAdminDashboardData();
  const stats = [
    dashboard.stats.newUsersToday,
    dashboard.stats.generationTasksToday,
    dashboard.stats.activeScripts,
    dashboard.stats.pendingOperations,
    dashboard.stats.aiUsageToday,
  ];

  return (
    <div className="dashboard-page">
      <header className="page-head">
        <div>
          <h1 className="page-title">工作台</h1>
          <div className="page-sub">
            上午好，今日平台有 {dashboard.pendingCount.toLocaleString("zh-CN")} 项内容待处理。
          </div>
        </div>
        <div className="page-actions">
          <Link className="admin-btn" href="/dashboard">
            <RefreshCw size={14} />
            刷新数据
          </Link>
          <Link className="admin-btn primary" href="/audit">
            <FileText size={14} />
            查看审计
          </Link>
        </div>
      </header>

      {dashboard.error && (
        <div className="admin-inline-alert" role="alert">
          {dashboard.error}
        </div>
      )}

      <section className="dashboard-stat-grid" aria-label="平台概览">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="dashboard-main-grid">
        <TrendCard points={dashboard.trend} />
        <TodoCard todos={dashboard.todos} />
      </section>

      <HealthCard items={dashboard.health} />
    </div>
  );
}

function DashboardStatCard({ stat }: { stat: AdminDashboardStat }) {
  const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FileText;

  return (
    <article className="stat-card">
      <div>
        <div className="stat-label">{stat.label}</div>
        <div className="stat-value">{stat.value}</div>
        <div className={`stat-trend stat-trend-${stat.tone}`}>{stat.trend}</div>
      </div>
      <div className={`stat-icon stat-icon-${stat.tone}`} aria-hidden="true">
        <Icon size={22} />
      </div>
    </article>
  );
}

function TrendCard({ points }: { points: AdminDashboardTrendPoint[] }) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.generatedTasks, point.newUsers]),
  );

  return (
    <section className="admin-card">
      <div className="admin-card-head dashboard-card-head">
        <div>
          <div className="admin-card-title">核心业务趋势</div>
          <div className="admin-card-sub">近 7 天</div>
        </div>
        <div className="dashboard-tabs" aria-label="趋势时间范围">
          <button className="dashboard-tab active" type="button">7 天</button>
          <button className="dashboard-tab" type="button">30 天</button>
          <button className="dashboard-tab" type="button">90 天</button>
        </div>
      </div>
      <div className="admin-card-body">
        <div className="dashboard-chart-legend">
          <span><i className="legend-dot legend-dot-primary" />生成任务</span>
          <span><i className="legend-dot legend-dot-success" />新增用户</span>
        </div>
        <div className="dashboard-bar-chart" aria-label="近 7 天生成任务与新增用户趋势">
          {points.map((point) => (
            <div className="dashboard-bar-group" key={point.label}>
              <div className="dashboard-bar-pair">
                <Bar value={point.generatedTasks} max={maxValue} tone="primary" />
                <Bar value={point.newUsers} max={maxValue} tone="success" />
              </div>
              <span className="bar-label">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone: "primary" | "success" }) {
  const height = Math.max(4, Math.round((value / max) * 100));

  return (
    <div className={`dashboard-bar dashboard-bar-${tone}`} style={{ height: `${height}%` }}>
      <span className="dashboard-bar-value">{value.toLocaleString("zh-CN")}</span>
    </div>
  );
}

function TodoCard({ todos }: { todos: AdminDashboardTodo[] }) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">运营待办</div>
        <div className="admin-card-sub">需立即处理</div>
      </div>
      <div className="dashboard-todo-list">
        {todos.map((todo) => (
          <Link className="dashboard-todo-row" href={todo.href} key={todo.title}>
            <span className={`dashboard-todo-icon dashboard-todo-icon-${todo.tone}`}>
              {todo.tone === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <span>
              <span className="dashboard-todo-title">{todo.title}</span>
              <span className="dashboard-todo-meta">{todo.meta}</span>
            </span>
          </Link>
        ))}
        {todos.length === 0 && (
          <div className="dashboard-todo-row">
            <span className="dashboard-todo-icon dashboard-todo-icon-success">
              <CheckCircle2 size={18} />
            </span>
            <span>
              <span className="dashboard-todo-title">暂无待办</span>
              <span className="dashboard-todo-meta">当前没有需要立即处理的事项</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function HealthCard({ items }: { items: AdminDashboardHealthItem[] }) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">服务健康度</div>
        <div className="admin-card-sub">近 1 小时</div>
      </div>
      <div className="admin-card-body">
        <div className="health-list">
          {items.map((item) => (
            <div className="health-item" key={item.label}>
              <div className="health-label">{item.label}</div>
              <div className="health-bar-wrap">
                <div
                  className={`health-bar health-bar-${item.tone}`}
                  style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                />
              </div>
              <div className="health-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
