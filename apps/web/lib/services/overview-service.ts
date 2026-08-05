/**
 * 概览页数据聚合服务
 *
 * 聚合当前剧本的进度、统计、工作流、待办、活动流，提供给概览页
 * （`app/(dashboard)/page.tsx`）渲染。
 *
 * 数据来源：scripts、validation_reports、generation_tasks 三张表。
 * 无剧本时返回空状态数据引导新用户创作；有剧本时基于真实数据聚合。
 *
 * 设计要点：
 * - 服务端方法（getOverviewData）通过动态导入 @/lib/supabase/server
 *   获取客户端，避免 next/headers 被打包进客户端 bundle（对齐
 *   generation-task-service.ts 的写法）；
 * - 当用户无剧本或聚合失败时返回空结构（EMPTY_DATA），不再使用 Mock 数据占位。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/lib/supabase/types';
import type { Script } from '@/types';

/* ============================================================
 * 类型定义
 * ============================================================ */

/** 工作流卡状态（与原型 .status-tag st-* 对齐） */
export type WorkflowStatus = 'valid' | 'gen' | 'draft' | 'done';

/** 统计卡图标色系（与原型 .stat-icon.si-* 对齐） */
export type StatIconKind = 'err' | 'warn' | 'ok' | 'info';

/** 待办分组类别 */
export type TodoKind = 'time' | 'logic' | 'foreshadow';

/** 活动流类别（与原型 .ac-dot 类名对齐） */
export type ActivityKind = 'edit' | 'ai' | 'check' | 'done' | 'gen';

/** 快捷入口图标 key */
export type QuickActionIcon = 'generate' | 'timeline' | 'logic' | 'clues' | 'illust';

/** 继续创作英雄区当前剧本信息 */
export interface OverviewCurrentScript {
  id: string | null;
  title: string;
  /** 类型 / 人数 / 时长 拼接，例：硬核 · 古风 · 6人 · 5h */
  genre: string;
  /** 当前所在幕次，例：第二幕 · 公共搜证 */
  stage: string;
  /** 编辑器定位描述（含段名），例：正在编辑：第二幕 · 公共搜证 · 第3段「药铺后院」 */
  location: string;
  /** 上次编辑时间展示串，例：14:32 */
  lastEditedAt: string;
  /** 上次编辑副标，例：上次编辑于 14:32 · 自动保存 */
  lastEditedTag: string;
  /** 完成度百分比 0-100 */
  progress: number;
  /** 英雄区右侧四枚 ri-pill 的展示信息 */
  issuePills: {
    kind: 'err' | 'warn' | 'ok';
    count: number;
    label: string;
    /** 点击跳转，不传则不可点 */
    href?: string;
  }[];
  /** 继续写作跳转地址 */
  editorHref: string;
  /** "先处理待办" 跳转地址 */
  todoHref: string;
}

/** 统计概览：聚合数（用于 ri-pill/徽标等场景） */
export interface OverviewStats {
  errors: number;
  warnings: number;
  success: number;
  info: number;
}

/** 行动型统计卡数据 */
export interface OverviewStatCard {
  icon: StatIconKind;
  label: string;
  value: string;
  /** 数值右侧的小字单位，如 "项" / "%" */
  unit?: string;
  /** 趋势行（默认绿色，trendDown=true 显示朱砂红） */
  trend: string;
  trendDown?: boolean;
  href: string;
}

/** 工作流剧本卡 */
export interface OverviewWorkflowCard {
  id: string;
  title: string;
  /** 类型短描述，例：硬核 · 古风 */
  genre: string;
  status: WorkflowStatus;
  /** 状态标签中文，例：校验中 / 生成中 / 草稿 / 已完成 */
  statusLabel: string;
  /** 进度百分比 0-100 */
  progress: number;
  /** 当前阶段描述，例：第二幕 · 公共搜证 */
  stage: string;
  /** 待办计数描述 */
  issues: {
    dotClass: 'err' | 'warn' | 'ok';
    label: string;
  };
  /** 人数 / 时长 · 版本 拼接 */
  meta: string;
  /** 更新时间展示串 */
  updatedAt: string;
  /** 是否已完成 */
  done: boolean;
  /** 点击跳转编辑器 */
  href: string;
}

/** 单条待办 */
export interface OverviewTodoItem {
  scriptTitle: string;
  description: string;
  href: string;
}

/** 待办分组 */
export interface OverviewTodoGroup {
  kind: TodoKind;
  /** 分组标题，例：时间冲突 / 逻辑漏洞 / 伏笔悬挂 */
  label: string;
  /** 圆点色（与 .dot 类名对齐） */
  dotClass: 'err' | 'warn';
  count: number;
  items: OverviewTodoItem[];
}

/** 活动流单条：textBefore + bold + textAfter 拼接为完整文案 */
export interface OverviewActivity {
  kind: ActivityKind;
  textBefore: string;
  /** 中间加粗片段 */
  bold: string;
  textAfter: string;
  /** 时间展示串，例：今日 14:32 · 自动保存 v3 */
  time: string;
}

/** AI 下一步建议卡 */
export interface OverviewAiSuggestion {
  tip: string;
  /** "应用建议" 跳转地址 */
  applyHref: string;
}

/** 快捷入口 */
export interface OverviewQuickAction {
  icon: QuickActionIcon;
  title: string;
  desc: string;
  href: string;
}

/** 概览页聚合数据 */
export interface OverviewData {
  currentScript: OverviewCurrentScript | null;
  progress: number;
  stats: OverviewStats;
  statCards: OverviewStatCard[];
  workflows: OverviewWorkflowCard[];
  todos: OverviewTodoGroup[];
  activities: OverviewActivity[];
  aiSuggestion: OverviewAiSuggestion;
  quickActions: OverviewQuickAction[];
}

/* ============================================================
 * 空状态数据
 * ============================================================ */

/**
 * 空状态数据：用户无剧本时返回，引导新用户开始创作。
 * 不包含任何虚假剧本信息。
 */
const EMPTY_DATA: OverviewData = {
  currentScript: null,
  progress: 0,
  stats: { errors: 0, warnings: 0, success: 0, info: 0 },
  statCards: [
    { icon: 'err', label: '待处理问题', value: '0', unit: '项', trend: '', href: '/generate' },
    { icon: 'warn', label: '今日待办', value: '0', unit: '项', trend: '', href: '/generate' },
    { icon: 'ok', label: '本月已交付', value: '0', unit: '部', trend: '', href: '/generate' },
    { icon: 'info', label: '平均完成度', value: '0', unit: '%', trend: '', href: '/generate' },
  ],
  workflows: [],
  todos: [],
  activities: [],
  aiSuggestion: { tip: '创建你的第一部剧本，开启 AI 辅助创作之旅', applyHref: '/generate' },
  quickActions: [],
};



/* ============================================================
 * 工具：DB 行映射
 * ============================================================ */

interface ScriptRow {
  id: string;
  author_id: string;
  title: string;
  genre: 'hardcore' | 'emotion' | 'horror' | 'funny' | 'mechanism';
  player_count: number;
  duration_hours: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'generating' | 'completed' | 'archived';
  word_count: number;
  created_at: string;
  updated_at: string;
}

interface ValidationReportRow {
  id: string;
  script_id: string;
  report_type: 'TIMELINE' | 'LOGIC' | 'DIFFICULTY' | 'FULL';
  status: 'in_progress' | 'completed' | 'cancelled';
  issue_count_severe: number;
  issue_count_warning: number;
  issue_count_hint: number;
  result_data: Json | null;
  created_at: string;
}

interface VersionSnapshotRow {
  id: string;
  script_id: string;
  version_number: number;
  change_summary: string;
  created_at: string;
}

interface GenerationTaskRow {
  id: string;
  script_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  result_data: Json | null;
}

const GENRE_LABEL: Record<ScriptRow['genre'], string> = {
  hardcore: '硬核',
  emotion: '情感',
  horror: '恐怖',
  funny: '欢乐',
  mechanism: '机制',
};

const DIFFICULTY_LABEL: Record<ScriptRow['difficulty'], string> = {
  beginner: '新手',
  intermediate: '进阶',
  advanced: '高阶',
};

/** 根据剧本状态映射为工作流状态 */
function mapWorkflowStatus(status: ScriptRow['status']): {
  status: WorkflowStatus;
  statusLabel: string;
} {
  switch (status) {
    case 'generating':
      return { status: 'gen', statusLabel: '生成中' };
    case 'completed':
      return { status: 'done', statusLabel: '已完成' };
    case 'archived':
      return { status: 'done', statusLabel: '已归档' };
    case 'draft':
    default:
      return { status: 'draft', statusLabel: '草稿' };
  }
}

/** 将 ISO 时间转为简短展示串（当日显示 HH:mm，否则显示相对天数） */
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 14) return '1 周前';
  if (diffDays < 21) return '2 周前';
  if (diffDays < 28) return '3 周前';
  return `${Math.floor(diffDays / 7)} 周前`;
}

/** 简单进度估算：word_count 与目标字数（默认 30000）比值，截到 0-100 */
function estimateProgress(wordCount: number, target = 30000): number {
  if (!wordCount) return 0;
  return Math.max(0, Math.min(100, Math.round((wordCount / target) * 100)));
}

/** 判断 ISO 时间是否为今日 */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** 从 validation_reports.result_data 解析时间线冲突条目 */
function extractTimelineConflicts(report: ValidationReportRow): { title: string; desc: string }[] {
  if (report.report_type !== 'TIMELINE' || !report.result_data) return [];
  const data = report.result_data as Record<string, unknown>;
  const conflicts = data.conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      title: String((c as Record<string, unknown>).title ?? '时间冲突'),
      desc: String((c as Record<string, unknown>).desc ?? ''),
    }));
}

/** 从 validation_reports.result_data 解析逻辑校验问题条目 */
function extractLogicIssues(report: ValidationReportRow): { title: string; desc: string; type: string }[] {
  if (!report.result_data || (report.report_type !== 'LOGIC' && report.report_type !== 'FULL')) return [];
  const data = report.result_data as Record<string, unknown>;
  const issues = data.issues;
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({
      title: String((i as Record<string, unknown>).title ?? '逻辑问题'),
      desc: String((i as Record<string, unknown>).description ?? ''),
      type: String((i as Record<string, unknown>).type ?? ''),
    }));
}

/* ============================================================
 * Service
 * ============================================================ */

export class OverviewService {
  /**
   * 聚合概览页数据
   *
   * 基于 scripts、validation_reports、generation_tasks 真实数据聚合；
   * 库为空或读取失败时返回 EMPTY_DATA，不再使用 Mock 数据占位。
   *
   * @param userId  当前登录用户 ID
   * @param scripts 可选：外部已加载的剧本列表（如来自 layout / Context）。
   *                传入时跳过 scripts 表查询，避免重复 DB 往返；
   *                未传入时自行查询（兼容旧调用）。
   */
  async getOverviewData(userId: string, scripts?: Script[]): Promise<OverviewData> {
    try {
      const supabase = await this.getServerClient();

      // 1) 剧本列表：优先复用外部传入数据，避免与 layout 重复查询 scripts 表
      let scriptRows: ScriptRow[];
      if (scripts) {
        if (scripts.length === 0) return EMPTY_DATA;
        scriptRows = scripts.map((s) => ({
          id: s.id,
          author_id: s.authorId,
          title: s.title,
          genre: s.genre,
          player_count: s.playerCount,
          duration_hours: s.durationHours,
          // ScriptDifficulty 含 'expert'，ScriptRow 暂未收录；沿用 cast 与 DB 路径保持一致
          difficulty: s.difficulty as ScriptRow['difficulty'],
          status: s.status,
          word_count: s.wordCount,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }));
      } else {
        const { data: rows, error: sErr } = await supabase
          .from('scripts')
          .select(
            'id, author_id, title, genre, player_count, duration_hours, difficulty, status, word_count, created_at, updated_at',
          )
          .eq('author_id', userId)
          .order('updated_at', { ascending: false });

        if (sErr || !rows || rows.length === 0) {
          return EMPTY_DATA;
        }
        scriptRows = rows as unknown as ScriptRow[];
      }

      const current = scriptRows[0];

      // 2) 并行读取校验报告、生成任务与版本快照
      const scriptIds = scriptRows.map((s) => s.id);
      const [validationRes, taskRes, snapshotRes] = await Promise.all([
        supabase
          .from('validation_reports')
          .select(
            'id, script_id, report_type, status, issue_count_severe, issue_count_warning, issue_count_hint, result_data, created_at',
          )
          .in('script_id', scriptIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('generation_tasks')
          .select('id, script_id, task_type, status, progress_percent, error_message, started_at, completed_at, created_at, result_data')
          .in('script_id', scriptIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('version_snapshots')
          .select('id, script_id, version_number, change_summary, created_at')
          .in('script_id', scriptIds)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const reports = (validationRes.data ?? []) as unknown as ValidationReportRow[];
      const tasks = (taskRes.data ?? []) as unknown as GenerationTaskRow[];
      const snapshots = (snapshotRes.data ?? []) as unknown as VersionSnapshotRow[];

      return this.compose(current, scriptRows, reports, tasks, snapshots);
    } catch {
      // 异常时返回空状态，避免展示虚假 Mock 数据
      return EMPTY_DATA;
    }
  }

  /** 由原始行组装 OverviewData；缺失项以空结构或默认值填充，不再使用 Mock 占位 */
  private compose(
    current: ScriptRow,
    scripts: ScriptRow[],
    reports: ValidationReportRow[],
    tasks: GenerationTaskRow[],
    snapshots: VersionSnapshotRow[],
  ): OverviewData {
    const editorBase = `/editor/${current.id}`;

    // 当前剧本的进度估算
    const progress = estimateProgress(current.word_count);

    // 当前剧本的校验报告聚合
    const currentReports = reports.filter((r) => r.script_id === current.id);
    const currentTimelineReports = currentReports.filter((r) => r.report_type === 'TIMELINE');
    const currentLogicReports = currentReports.filter((r) => r.report_type === 'LOGIC' || r.report_type === 'FULL');
    const timelineErrors = currentTimelineReports.reduce((s, r) => s + r.issue_count_severe, 0);
    const logicErrors = currentLogicReports.reduce((s, r) => s + r.issue_count_severe, 0);
    const foreshadows = currentLogicReports.reduce((s, r) => s + r.issue_count_warning, 0);

    const currentScript: OverviewCurrentScript = {
      id: current.id,
      title: current.title,
      genre: `${GENRE_LABEL[current.genre] ?? current.genre} · ${current.player_count}人 · ${current.duration_hours}h`,
      stage: '当前剧本',
      location: `正在编辑：${current.title}`,
      lastEditedAt: formatUpdatedAt(current.updated_at),
      lastEditedTag: `▸ 上次编辑于 ${formatUpdatedAt(current.updated_at)} · 自动保存`,
      progress,
      issuePills: [
        { kind: 'err', count: timelineErrors, label: '时间冲突', href: `${editorBase}/timeline` },
        { kind: 'err', count: logicErrors, label: '逻辑漏洞', href: `${editorBase}/validation` },
        { kind: 'warn', count: foreshadows, label: '伏笔悬挂', href: `${editorBase}/validation` },
      ],
      editorHref: editorBase,
      todoHref: `${editorBase}/validation`,
    };

    // 工作流卡（按脚本列表渲染）
    const workflows: OverviewWorkflowCard[] = scripts.map((s) => {
      const wf = mapWorkflowStatus(s.status);
      const sReports = reports.filter((r) => r.script_id === s.id);
      const sSevere = sReports.reduce((acc, r) => acc + r.issue_count_severe, 0);
      const sWarn = sReports.reduce((acc, r) => acc + r.issue_count_warning, 0);
      const wfProgress = s.status === 'completed' ? 100 : estimateProgress(s.word_count);
      const issues = sSevere > 0
        ? { dotClass: 'err' as const, label: `${sSevere} 待处理` }
        : sWarn > 0
          ? { dotClass: 'warn' as const, label: `${sWarn} 待确认` }
          : { dotClass: 'ok' as const, label: '无待办' };
      return {
        id: s.id,
        title: s.title,
        genre: `${GENRE_LABEL[s.genre] ?? s.genre} · ${DIFFICULTY_LABEL[s.difficulty] ?? s.difficulty}`,
        status: wf.status,
        statusLabel: wf.statusLabel,
        progress: wfProgress,
        stage: s.status === 'completed' ? '已交付店家' : '当前剧本',
        issues,
        meta: `${s.player_count}人 / ${s.duration_hours}h · v1`,
        updatedAt: formatUpdatedAt(s.updated_at),
        done: s.status === 'completed' || s.status === 'archived',
        href: `/editor/${s.id}`,
      };
    });

    // 统计卡：跨剧本真实聚合，并指向对应子模块
    const allSevere = reports.reduce((s, r) => s + r.issue_count_severe, 0);
    const allWarning = reports.reduce((s, r) => s + r.issue_count_warning, 0);
    const allHint = reports.reduce((s, r) => s + r.issue_count_hint, 0);
    const totalIssues = allSevere + allWarning;
    const todayRunningTasks = tasks.filter(
      (t) => isToday(t.created_at) && (t.status === 'pending' || t.status === 'running'),
    ).length;
    const todayInProgressReports = reports.filter((r) => isToday(r.created_at) && r.status === 'in_progress').length;
    const todayTodoCount = todayRunningTasks + todayInProgressReports;
    const completedThisMonth = scripts.filter((s) => {
      if (s.status !== 'completed') return false;
      const d = new Date(s.updated_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const avgProgress = workflows.length
      ? Math.round(workflows.reduce((s, w) => s + w.progress, 0) / workflows.length)
      : 0;

    const statCards: OverviewStatCard[] = [
      {
        icon: 'err',
        label: '待处理问题',
        value: String(totalIssues),
        unit: '项',
        trend: `${allSevere} 严重 · ${allWarning} 警告 · ${allHint} 提示`,
        trendDown: totalIssues > 0,
        href: '/scripts',
      },
      {
        icon: 'warn',
        label: '今日待办',
        value: String(todayTodoCount),
        unit: '项',
        trend:
          todayRunningTasks > 0 || todayInProgressReports > 0
            ? `${todayRunningTasks} 生成/校验中 · ${todayInProgressReports} 校验待完成`
            : '暂无今日待处理任务',
        href: '/scripts',
      },
      {
        icon: 'ok',
        label: '本月已交付',
        value: String(completedThisMonth),
        unit: '部',
        trend: completedThisMonth > 0 ? '本月新交付' : '暂无交付',
        href: '/scripts',
      },
      {
        icon: 'info',
        label: '平均完成度',
        value: String(avgProgress),
        unit: '%',
        trend: avgProgress > 0 ? `${workflows.filter((w) => w.progress > 0).length} 部进行中` : '暂无进度',
        href: '/scripts',
      },
    ];

    // 待办汇总：解析具体校验问题，跨剧本聚合，点击跳转到对应校验子页
    const timeItems: OverviewTodoItem[] = [];
    const logicItems: OverviewTodoItem[] = [];
    const foreshadowItems: OverviewTodoItem[] = [];

    for (const s of scripts) {
      const sReports = reports.filter((r) => r.script_id === s.id);
      const sEditorHref = `/editor/${s.id}`;
      for (const r of sReports) {
        if (r.report_type === 'TIMELINE') {
          for (const c of extractTimelineConflicts(r).slice(0, 3)) {
            timeItems.push({
              scriptTitle: s.title,
              description: c.title,
              href: `${sEditorHref}/timeline`,
            });
          }
        }
        if (r.report_type === 'LOGIC' || r.report_type === 'FULL') {
          const issues = extractLogicIssues(r);
          const criticalLogic = issues.filter((i) => !/伏笔/.test(i.type)).slice(0, 3);
          const foreshadowIssues = issues.filter((i) => /伏笔/.test(i.type)).slice(0, 3);
          for (const i of criticalLogic) {
            logicItems.push({
              scriptTitle: s.title,
              description: i.title,
              href: `${sEditorHref}/validation`,
            });
          }
          for (const i of foreshadowIssues) {
            foreshadowItems.push({
              scriptTitle: s.title,
              description: i.title,
              href: `${sEditorHref}/validation`,
            });
          }
        }
      }
    }

    const todos: OverviewTodoGroup[] = [
      { kind: 'time' as const, label: '时间冲突', dotClass: 'err' as const, count: timeItems.length, items: timeItems.slice(0, 5) },
      { kind: 'logic' as const, label: '逻辑漏洞', dotClass: 'err' as const, count: logicItems.length, items: logicItems.slice(0, 5) },
      {
        kind: 'foreshadow' as const,
        label: '伏笔悬挂',
        dotClass: 'warn' as const,
        count: foreshadowItems.length,
        items: foreshadowItems.slice(0, 5),
      },
    ].filter((g) => g.count > 0);

    // 活动流：合并版本快照、生成任务、校验报告，按时间倒序取前 6 条
    type ActivityCandidate = OverviewActivity & { at: string };
    const candidates: ActivityCandidate[] = [];

    for (const sn of snapshots.slice(0, 10)) {
      const script = scripts.find((s) => s.id === sn.script_id);
      candidates.push({
        kind: 'edit',
        textBefore: '编辑保存 ',
        bold: script?.title ?? '剧本',
        textAfter: sn.change_summary ? ` · ${sn.change_summary}` : '',
        time: `v${sn.version_number} · ${formatUpdatedAt(sn.created_at)}`,
        at: sn.created_at,
      });
    }

    for (const t of tasks.slice(0, 10)) {
      const script = scripts.find((s) => s.id === t.script_id);
      const scriptTitle = script?.title ?? '剧本';
      const time = formatUpdatedAt(t.completed_at ?? t.started_at ?? t.created_at);
      if (t.status === 'completed' && t.task_type === 'FULL_SCRIPT') {
        candidates.push({
          kind: 'gen',
          textBefore: 'AI 生成 ',
          bold: scriptTitle,
          textAfter: ' 初版',
          time: `${time} · ${script?.word_count ?? 0} 字`,
          at: t.completed_at ?? t.created_at,
        });
      } else if (t.status === 'running' || t.status === 'pending') {
        candidates.push({
          kind: 'ai',
          textBefore: 'AI 处理中 ',
          bold: scriptTitle,
          textAfter: ` · ${t.progress_percent}%`,
          time,
          at: t.started_at ?? t.created_at,
        });
      } else if (t.status === 'failed') {
        candidates.push({
          kind: 'ai',
          textBefore: 'AI 任务失败 ',
          bold: scriptTitle,
          textAfter: t.error_message ? ` · ${t.error_message}` : '',
          time,
          at: t.completed_at ?? t.created_at,
        });
      }
    }

    for (const r of reports.slice(0, 10)) {
      const script = scripts.find((s) => s.id === r.script_id);
      const scriptTitle = script?.title ?? '剧本';
      const issueTotal = r.issue_count_severe + r.issue_count_warning + r.issue_count_hint;
      if (r.report_type === 'TIMELINE') {
        candidates.push({
          kind: 'check',
          textBefore: '时间线校验 ',
          bold: `${issueTotal} 处冲突`,
          textAfter: ` · ${scriptTitle}`,
          time: formatUpdatedAt(r.created_at),
          at: r.created_at,
        });
      } else if (r.report_type === 'LOGIC' || r.report_type === 'FULL') {
        candidates.push({
          kind: 'check',
          textBefore: '逻辑校验 ',
          bold: `${issueTotal} 处问题`,
          textAfter: ` · ${scriptTitle}`,
          time: formatUpdatedAt(r.created_at),
          at: r.created_at,
        });
      }
    }

    const activities = candidates
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6)
      .map((c) => ({
        kind: c.kind,
        textBefore: c.textBefore,
        bold: c.bold,
        textAfter: c.textAfter,
        time: c.time,
      }));

    // AI 建议：基于当前剧本真实校验数据
    const currentIssueTotal = timelineErrors + logicErrors + foreshadows;
    const aiSuggestion: OverviewAiSuggestion = {
      tip:
        currentIssueTotal > 0
          ? `《${current.title}》还有 ${currentIssueTotal} 处待处理问题（${timelineErrors} 时间冲突、${logicErrors} 逻辑漏洞、${foreshadows} 伏笔悬挂），建议优先修复。`
          : `《${current.title}》当前进展顺利，继续完善剧本结构与细节吧。`,
      applyHref: `${editorBase}/validation`,
    };

    return {
      currentScript,
      progress,
      stats: { errors: allSevere, warnings: allWarning, success: 0, info: allHint },
      statCards,
      workflows,
      todos,
      activities,
      aiSuggestion,
      quickActions: [],
    };
  }

  /** 动态导入服务端 Supabase Client（避免 next/headers 进入客户端 bundle） */
  private async getServerClient(): Promise<SupabaseClient> {
    const { createClient } = await import('@/lib/supabase/server');
    return createClient();
  }
}

/** 单例，便于在 Server Component 中直接调用 */
export const overviewService = new OverviewService();
