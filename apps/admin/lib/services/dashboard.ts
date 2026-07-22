import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminDashboardStat = {
  label: string;
  value: string;
  trend: string;
  tone: "info" | "success" | "warning" | "error";
};

export type AdminDashboardTodo = {
  title: string;
  meta: string;
  href: string;
  tone: "info" | "success" | "warning" | "error";
};

export type AdminDashboardTrendPoint = {
  label: string;
  generatedTasks: number;
  newUsers: number;
};

export type AdminDashboardHealthItem = {
  label: string;
  value: string;
  percent: number;
  tone: "info" | "success" | "warning" | "error" | "purple";
};

export type AdminDashboardData = {
  stats: {
    newUsersToday: AdminDashboardStat;
    generationTasksToday: AdminDashboardStat;
    activeScripts: AdminDashboardStat;
    pendingOperations: AdminDashboardStat;
    aiUsageToday: AdminDashboardStat;
  };
  todos: AdminDashboardTodo[];
  trend: AdminDashboardTrendPoint[];
  health: AdminDashboardHealthItem[];
  pendingCount: number;
  error?: string;
};

const EMPTY_DASHBOARD: AdminDashboardData = {
  stats: {
    newUsersToday: {
      label: "今日新增用户",
      value: "0",
      trend: "昨日 0 人",
      tone: "info",
    },
    generationTasksToday: {
      label: "今日生成任务",
      value: "0",
      trend: "成功率 0%",
      tone: "success",
    },
    activeScripts: {
      label: "活跃剧本",
      value: "0",
      trend: "近 7 日更新 0 个",
      tone: "info",
    },
    pendingOperations: {
      label: "待审核举报",
      value: "0",
      trend: "其中 0 项已超 24 小时",
      tone: "warning",
    },
    aiUsageToday: {
      label: "AI 调用量",
      value: "0",
      trend: "Token 0",
      tone: "warning",
    },
  },
  todos: [],
  trend: [],
  health: [],
  pendingCount: 0,
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return {
      ...EMPTY_DASHBOARD,
      error: "未配置 Supabase service role，无法读取真实工作台数据。",
    };
  }
  const client = supabase;

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -6);
  const lastHourStart = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    usersToday,
    usersYesterday,
    generationTasksToday,
    completedGenerationTasksToday,
    failedGenerationTasks,
    failedIllustrationTasks,
    activeScripts,
    scriptsUpdatedThisWeek,
    bannedUsers,
    totalChargedCreditsToday,
    generationTasksLastHour,
    completedGenerationTasksLastHour,
    illustrationTasksLastHour,
    completedIllustrationTasksLastHour,
  ] = await Promise.all([
    countRows("users", [["created_at", "gte", todayStart.toISOString()]]),
    countRows("users", [
      ["created_at", "gte", yesterdayStart.toISOString()],
      ["created_at", "lt", todayStart.toISOString()],
    ]),
    countRows("generation_tasks", [["created_at", "gte", todayStart.toISOString()]]),
    countRows("generation_tasks", [
      ["created_at", "gte", todayStart.toISOString()],
      ["status", "eq", "completed"],
    ]),
    countRows("generation_tasks", [["status", "eq", "failed"]]),
    countRows("illustration_tasks", [["status", "eq", "failed"]]),
    countRows("scripts", [["status", "neq", "archived"]]),
    countRows("scripts", [["updated_at", "gte", weekStart.toISOString()]]),
    countRows("users", [["is_banned", "eq", true]]),
    sumColumn("generation_tasks", "charged_credits", [["created_at", "gte", todayStart.toISOString()]]),
    countRows("generation_tasks", [["created_at", "gte", lastHourStart.toISOString()]]),
    countRows("generation_tasks", [
      ["created_at", "gte", lastHourStart.toISOString()],
      ["status", "eq", "completed"],
    ]),
    countRows("illustration_tasks", [["created_at", "gte", lastHourStart.toISOString()]]),
    countRows("illustration_tasks", [
      ["created_at", "gte", lastHourStart.toISOString()],
      ["status", "eq", "completed"],
    ]),
  ]);

  const failedTasks = failedGenerationTasks + failedIllustrationTasks;
  const pendingCount = failedTasks + bannedUsers;
  const successRate = generationTasksToday > 0
    ? Math.round((completedGenerationTasksToday / generationTasksToday) * 1000) / 10
    : 0;
  const estimatedAiTokens = totalChargedCreditsToday * 1000;
  const trend = await buildTrend(todayStart);
  const generationHealth = percentage(completedGenerationTasksLastHour, generationTasksLastHour);
  const illustrationHealth = percentage(completedIllustrationTasksLastHour, illustrationTasksLastHour);

  return {
    stats: {
      newUsersToday: {
        label: "今日新增用户",
        value: formatNumber(usersToday),
        trend: `昨日 ${formatNumber(usersYesterday)} 人`,
        tone: "info",
      },
      generationTasksToday: {
        label: "今日生成任务",
        value: formatNumber(generationTasksToday),
        trend: `成功率 ${successRate}%`,
        tone: "success",
      },
      activeScripts: {
        label: "活跃剧本",
        value: formatNumber(activeScripts),
        trend: `近 7 日更新 ${formatNumber(scriptsUpdatedThisWeek)} 个`,
        tone: "info",
      },
      pendingOperations: {
        label: "待审核举报",
        value: formatNumber(pendingCount),
        trend: `${formatNumber(failedTasks)} 个失败任务，${formatNumber(bannedUsers)} 个封禁账号`,
        tone: pendingCount > 0 ? "warning" : "success",
      },
      aiUsageToday: {
        label: "AI 调用量",
        value: formatCompact(generationTasksToday + illustrationTasksLastHour),
        trend: `Token ${formatCompact(estimatedAiTokens)}`,
        tone: "warning",
      },
    },
    todos: buildTodos({
      failedTasks,
      failedIllustrationTasks,
      bannedUsers,
    }),
    trend,
    health: [
      {
        label: "剧本生成成功率",
        value: `${generationHealth}%`,
        percent: generationHealth,
        tone: "info",
      },
      {
        label: "插画生成成功率",
        value: `${illustrationHealth}%`,
        percent: illustrationHealth,
        tone: "purple",
      },
      {
        label: "API 平均响应",
        value: "—",
        percent: 0,
        tone: "success",
      },
    ],
    pendingCount,
  };

  async function countRows(
    table: string,
    filters: Array<[string, "eq" | "neq" | "gte" | "lt", string | number | boolean]>,
  ) {
    let query = client
      .from(table)
      .select("*", { count: "exact", head: true });

    for (const [column, operator, value] of filters) {
      if (operator === "eq") query = query.eq(column, value);
      if (operator === "neq") query = query.neq(column, value);
      if (operator === "gte") query = query.gte(column, value);
      if (operator === "lt") query = query.lt(column, value);
    }

    const { count, error } = await query;
    if (error) return 0;

    return count ?? 0;
  }

  async function sumColumn(
    table: string,
    column: string,
    filters: Array<[string, "eq" | "neq" | "gte" | "lt", string | number | boolean]>,
  ) {
    let query = client.from(table).select(column);

    for (const [filterColumn, operator, value] of filters) {
      if (operator === "eq") query = query.eq(filterColumn, value);
      if (operator === "neq") query = query.neq(filterColumn, value);
      if (operator === "gte") query = query.gte(filterColumn, value);
      if (operator === "lt") query = query.lt(filterColumn, value);
    }

    const { data, error } = await query;
    if (error || !data) return 0;

    return data.reduce((total, row) => {
      const value = row[column as keyof typeof row];
      return total + (typeof value === "number" ? value : 0);
    }, 0);
  }

  async function buildTrend(today: Date): Promise<AdminDashboardTrendPoint[]> {
    const days = Array.from({ length: 7 }, (_, index) => {
      const start = addDays(today, index - 6);
      const end = addDays(start, 1);
      return { start, end };
    });

    const points = await Promise.all(
      days.map(async ({ start, end }, index) => {
        const [generatedTasks, newUsers] = await Promise.all([
          countRows("generation_tasks", [
            ["created_at", "gte", start.toISOString()],
            ["created_at", "lt", end.toISOString()],
          ]),
          countRows("users", [
            ["created_at", "gte", start.toISOString()],
            ["created_at", "lt", end.toISOString()],
          ]),
        ]);

        return {
          label: index === days.length - 1 ? "今日" : formatMonthDay(start),
          generatedTasks,
          newUsers,
        };
      }),
    );

    return points;
  }
}

function buildTodos({
  failedTasks,
  failedIllustrationTasks,
  bannedUsers,
}: {
  failedTasks: number;
  failedIllustrationTasks: number;
  bannedUsers: number;
}): AdminDashboardTodo[] {
  return [
    {
      title: "待处理举报",
      meta: bannedUsers > 0 ? `${formatNumber(bannedUsers)} 个封禁账号需复核` : "举报队列表待接入",
      href: bannedUsers > 0 ? "/users?status=banned" : "/moderation",
      tone: bannedUsers > 0 ? "error" : "warning",
    },
    {
      title: "待审核剧本",
      meta: "剧本审核状态字段待接入",
      href: "/scripts",
      tone: "warning",
    },
    {
      title: "失败生成任务",
      meta: `${formatNumber(failedTasks)} 个任务需要人工确认重试`,
      href: "/tasks/generation",
      tone: failedTasks > 0 ? "info" : "success",
    },
    {
      title: "画质警告",
      meta: `${formatNumber(failedIllustrationTasks)} 个插画任务异常`,
      href: "/tasks/illustration",
      tone: failedIllustrationTasks > 0 ? "error" : "success",
    },
  ];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${Math.round((value / 10000) * 10) / 10}K`;
  }

  return formatNumber(value);
}

function formatMonthDay(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
