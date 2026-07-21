/**
 * 额度计费管理页（T203）
 *
 * 路由：/settings/quota
 *
 * 服务端组件，直接从 layout 已查的 profile（React cache 共享）构造当前
 * 套餐信息，并查询 credit_transactions 表获取最近创作点流水。
 *
 * 视觉对齐项目古风系统：朱砂红 + 纸张色 + 印章质感。
 * 包含：
 *   1. 当前套餐卡（免费版 / 专业版 + 创作点余额）
 *   2. 三档套餐卡（入门版 / 专业版 / 工作室版）
 *   3. 升级专业版按钮（开发期 mock：直接调用 upgradePlan）
 *   4. 创作点流水（最近 20 条消费/返还/发放记录）
 *
 * 性能优化（T418）：
 * - 通过 React `cache()` 共享 layout 已查的 `getUser()` 与 users 表查询，
 *   避免重复 DB 往返（详见 `lib/queries/dashboard-queries.ts`）；
 * - 额度信息从 profile 直接构造，不再调用 QuotaService.getQuotaInfo，
 *   消除 users 表的重复查询；upgradePlan server action 仍走 QuotaService。
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Check,
  Crown,
  History,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  getCachedUser,
  getCachedProfile,
} from '@/lib/queries/dashboard-queries';
import {
  QuotaService,
  type CreditInfo,
  type CreditTransaction,
  type QuotaInfo,
} from '@/lib/services/quota-service';
import { EmptyState } from '@/components/common/state-views';
import './quota.css';

/** 套餐标签映射 */
const PLAN_LABEL: Record<QuotaInfo['planType'], string> = {
  free: '免费版',
  pro: '专业版',
};

interface PricingPlan {
  id: 'starter' | 'pro' | 'studio';
  name: string;
  price: string;
  audience: string;
  credits: string;
  output: string;
  features: string[];
  highlighted?: boolean;
  actionLabel: string;
  disabled?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: '入门版',
    price: '¥49/月',
    audience: '新手作者、低频创作',
    credits: '300 创作点',
    output: '约 1 本完整短中篇剧本',
    features: ['基础逻辑校验', '少量线索卡 / 插画', '失败生成自动返还'],
    actionLabel: '暂未开通',
    disabled: true,
  },
  {
    id: 'pro',
    name: '专业版',
    price: '¥129/月',
    audience: '职业作者、稳定创作',
    credits: '1000 创作点',
    output: '约 3-4 本剧本',
    features: ['完整逻辑校验', '版本历史', '高清无水印导出'],
    highlighted: true,
    actionLabel: '升级专业版',
  },
  {
    id: 'studio',
    name: '工作室版',
    price: '¥399/月',
    audience: '小团队 / 发行工作室',
    credits: '4000 创作点',
    output: '约 10 本剧本',
    features: ['团队协作', '素材批量导出', '优先队列'],
    actionLabel: '暂未开通',
    disabled: true,
  },
];

const TRANSACTION_TYPE_LABEL: Record<CreditTransaction['type'], string> = {
  grant: '发放',
  consume: '消费',
  refund: '返还',
  adjustment: '调整',
};

/** 升级套餐 server action（开发期 mock：直接置为 pro） */
async function upgradeToPro() {
  'use server';
  // 复用 layout 已查的 user（React cache 命中，避免重复 getUser 调用）
  const user = await getCachedUser();
  if (!user) redirect('/auth/login');
  const service = new QuotaService();
  await service.upgradePlan(user.id);
  redirect('/settings/quota');
}

/** 格式化日期为 "MM-DD HH:mm" */
function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

/** 由 profile 构造 QuotaInfo（profile 为空时回退默认值） */
function buildQuotaFromProfile(
  profile: {
    free_quota_used: number;
    free_quota_limit: number;
    plan_type: string;
  } | null,
): { info: QuotaInfo; error: string | null } {
  if (!profile) {
    return {
      info: { used: 0, limit: 10, remaining: 10, planType: 'free' },
      error: '未能读取额度信息，已显示默认值。',
    };
  }
  const used = profile.free_quota_used;
  const limit = profile.free_quota_limit;
  return {
    info: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      planType: profile.plan_type === 'pro' ? 'pro' : 'free',
    },
    error: null,
  };
}

function buildCreditFallback(quotaInfo: QuotaInfo): CreditInfo {
  const balance = quotaInfo.planType === 'pro' ? 1000 : quotaInfo.remaining * 3;
  return {
    balance,
    monthlyGrant: quotaInfo.planType === 'pro' ? 1000 : 30,
    planType: quotaInfo.planType,
  };
}

function describeTransaction(row: CreditTransaction): string {
  if (row.reason) return row.reason;
  if (row.type === 'grant') return '创作点发放';
  if (row.type === 'refund') return '生成失败返还';
  if (row.type === 'consume') return 'AI 生成消费';
  return '额度调整';
}

export default async function QuotaPage() {
  // 复用 layout 已查的 user（React cache 命中，无重复 getUser 调用）
  const user = await getCachedUser();
  if (!user) redirect('/auth/login');

  // 复用 layout 已查的 profile，直接构造额度信息（避免重复查询 users 表）
  const profile = await getCachedProfile(user.id);
  const { info: quotaInfo, error: quotaError } = buildQuotaFromProfile(profile);
  const quotaService = new QuotaService();
  let creditInfo = buildCreditFallback(quotaInfo);
  let historyRows: CreditTransaction[] = [];
  let creditError: string | null = null;

  try {
    [creditInfo, historyRows] = await Promise.all([
      quotaService.getCreditInfo(user.id),
      quotaService.getCreditTransactions(user.id, 20),
    ]);
  } catch (error) {
    creditError =
      error instanceof Error
        ? `创作点账户暂不可用，已显示旧额度估算：${error.message}`
        : '创作点账户暂不可用，已显示旧额度估算。';
  }

  const isPro = creditInfo.planType === 'pro';
  const usedPercent =
    creditInfo.monthlyGrant > 0
      ? Math.min(100, Math.round(((creditInfo.monthlyGrant - creditInfo.balance) / creditInfo.monthlyGrant) * 100))
      : 0;
  const isQuotaLow = creditInfo.balance <= Math.max(15, Math.round(creditInfo.monthlyGrant * 0.15));

  return (
    <section className="quota-page">
      {/* ============ 页头 ============ */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <Crown size={22} />
            额度与套餐 <span className="seal">QUOTA</span>
          </h1>
          <div className="page-desc">
            管理你的 AI 创作点与订阅套餐
          </div>
        </div>
        <div className="page-actions">
          <Link href="/dashboard" className="btn btn-ghost">
            返回概览
          </Link>
        </div>
      </div>

      {quotaError ? (
        <div className="quota-warn" role="alert">{quotaError}</div>
      ) : null}
      {creditError ? (
        <div className="quota-warn" role="alert">{creditError}</div>
      ) : null}

      {/* ============ 当前套餐 + 进度条 ============ */}
      <div className={`quota-current-card ${isPro ? 'is-pro' : ''}`}>
        <div className="qc-left">
          <div className="qc-plan-badge">
            {isPro ? <Crown size={14} /> : <Sparkles size={14} />}
            {PLAN_LABEL[creditInfo.planType]}
          </div>
          <div className="qc-title">
            {isPro ? '专业版创作者' : '免费体验中'}
          </div>
          <div className="qc-desc">
            {isPro
              ? `本月已发放 ${creditInfo.monthlyGrant} 创作点，失败生成会自动返还。`
              : `当前剩余 ${creditInfo.balance} / ${creditInfo.monthlyGrant} 创作点。`}
          </div>
        </div>
        <div className="qc-right">
          <div className="qc-progress-label">
            <span>创作点余额</span>
            <span className={`qc-pct ${isQuotaLow ? 'low' : ''}`}>
              {creditInfo.balance} 点
            </span>
          </div>
          <div className={`qc-progress-bar ${isPro ? 'pro' : ''}`}>
            <div
              className={`qc-progress-fill ${isQuotaLow ? 'low' : ''} ${isPro ? 'pro' : ''}`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          {isQuotaLow ? (
            <div className="qc-hint">
              <Zap size={12} />
              创作点即将用尽，升级或补充点数后可继续创作。
            </div>
          ) : null}
        </div>
      </div>

      {/* ============ 套餐价格卡 ============ */}
      <div className="quota-compare-card">
        <div className="card-head">
          <h3>
            <TrendingUp size={16} />
            套餐设计
          </h3>
          <span className="pricing-note">开发期价格方案</span>
        </div>
        <div className="qc-compare-body">
          <div className="pricing-grid">
            {PRICING_PLANS.map((plan) => {
              const isCurrentPro = isPro && plan.id === 'pro';
              const Icon = plan.id === 'studio' ? Users : plan.id === 'starter' ? Layers : Crown;
              return (
                <article
                  key={plan.id}
                  className={`pricing-card ${plan.highlighted ? 'is-highlighted' : ''}`}
                >
                  {plan.highlighted ? <div className="pricing-ribbon">推荐</div> : null}
                  <div className="pricing-head">
                    <div className="pricing-icon" aria-hidden="true">
                      <Icon size={17} />
                    </div>
                    <div>
                      <h4>{plan.name}</h4>
                      <p>{plan.audience}</p>
                    </div>
                  </div>
                  <div className="pricing-price">
                    {plan.price}
                  </div>
                  <div className="pricing-credit">{plan.credits}</div>
                  <div className="pricing-output">{plan.output}</div>
                  <ul className="pricing-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={14} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrentPro ? (
                    <div className="qc-current-tag pricing-action">
                      <Crown size={14} />
                      当前套餐
                    </div>
                  ) : plan.id === 'pro' ? (
                    <form action={upgradeToPro}>
                      <button type="submit" className="btn btn-primary qc-upgrade-btn pricing-action">
                        <Crown size={15} />
                        {plan.actionLabel}
                        <span className="qc-mock-tag">开发期 mock</span>
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="btn btn-ghost pricing-action" disabled>
                      {plan.actionLabel}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ 创作点流水 ============ */}
      <div className="quota-history-card">
        <div className="card-head">
          <h3>
            <History size={16} />
            创作点流水
          </h3>
          <span className="qh-count">
            最近 {historyRows?.length ?? 0} 条
          </span>
        </div>
        {historyRows && historyRows.length > 0 ? (
          <div className="qh-list">
            {historyRows.map((row) => {
              const statusClass =
                row.amount > 0
                  ? 'ok'
                  : row.type === 'consume'
                    ? 'gen'
                    : 'warn';
              return (
                <div key={row.id} className="qh-row">
                  <div className="qh-type">
                    {describeTransaction(row)}
                  </div>
                  <div className="qh-time">
                    {formatTime(row.createdAt)}
                  </div>
                  <div className={`qh-status qh-${statusClass}`}>
                    {row.amount > 0 ? '+' : ''}{row.amount} 点 · {TRANSACTION_TYPE_LABEL[row.type]}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="暂无使用记录"
            description="开始使用 AI 生成功能后，这里会展示最近的创作点消费和返还。"
            Icon={History}
          />
        )}
      </div>
    </section>
  );
}
