/**
 * 新建剧本页（增强版 · T501）
 *
 * 路由：/scripts/new
 *
 * 客户端组件：双栏布局，提供两种创建方式：
 *   1. 空白创建：填写基础信息创建 status=draft 剧本，跳转 /editor/[scriptId]
 *   2. AI 智能生成：携带参数跳转 /generate 预填表单
 *
 * 表单字段（9 项，与 generate 页对齐）：
 *   标题/题材/人数/时长/难度/适龄分级/写作风格/背景设定/核心立意
 *
 * 参数合理性校验复用 lib/utils/script-param-validation
 * 视觉对齐项目古风系统：朱砂标签 + 印章质感 + 纸张色卡片
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  PenLine,
  Sparkles,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ScriptDifficulty, ScriptGenre } from '@/types';
import type { AgeRating, WritingStyle } from '@/lib/ai/prompts/script-generation';
import { validateScriptParams } from '@/lib/utils/script-param-validation';
import '../scripts.css';

/** 题材选项 */
const GENRE_OPTIONS: Array<{ value: ScriptGenre; label: string }> = [
  { value: 'hardcore', label: '硬核' },
  { value: 'emotion', label: '情感' },
  { value: 'horror', label: '恐怖' },
  { value: 'funny', label: '欢乐' },
  { value: 'mechanism', label: '机制' },
];

/** 难度选项 */
const DIFFICULTY_OPTIONS: Array<{ value: ScriptDifficulty; label: string }> = [
  { value: 'beginner', label: '新手' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '烧脑' },
  { value: 'expert', label: '专家' },
];

/** 适龄分级选项 */
const AGE_RATING_OPTIONS: Array<{ value: AgeRating; label: string }> = [
  { value: 'ALL', label: '全员' },
  { value: 'TWELVE_PLUS', label: '12+' },
  { value: 'SIXTEEN_PLUS', label: '16+' },
  { value: 'EIGHTEEN_PLUS', label: '18+' },
];

/** 写作风格选项 */
const WRITING_STYLE_OPTIONS: WritingStyle[] = [
  '古风沉稳',
  '白描清雅',
  '悬疑冷峻',
  '诙谐明快',
];

/** 题材中文映射（预览面板用） */
const GENRE_LABEL: Record<ScriptGenre, string> = {
  hardcore: '硬核',
  emotion: '情感',
  horror: '恐怖',
  funny: '欢乐',
  mechanism: '机制',
};

/** 难度中文映射（预览面板用） */
const DIFFICULTY_LABEL: Record<ScriptDifficulty, string> = {
  beginner: '新手',
  intermediate: '进阶',
  advanced: '烧脑',
  expert: '专家',
};

/** 适龄分级中文映射（预览面板用） */
const AGE_RATING_LABEL: Record<AgeRating, string> = {
  ALL: '全员',
  TWELVE_PLUS: '12+',
  SIXTEEN_PLUS: '16+',
  EIGHTEEN_PLUS: '18+',
};

/** 创建方式 */
type CreateMode = 'blank' | 'ai';

/** 表单状态 */
interface NewScriptForm {
  title: string;
  genre: ScriptGenre;
  players: number;
  duration: number;
  difficulty: ScriptDifficulty;
  ageRating: AgeRating;
  writingStyle: WritingStyle;
  background: string;
  theme: string;
}

/** 默认表单值 */
const DEFAULT_FORM: NewScriptForm = {
  title: '',
  genre: 'hardcore',
  players: 6,
  duration: 4,
  difficulty: 'intermediate',
  ageRating: 'SIXTEEN_PLUS',
  writingStyle: '古风沉稳',
  background: '',
  theme: '',
};

/**
 * 新建剧本页（增强版）
 */
export default function NewScriptPage() {
  const router = useRouter();
  const [form, setForm] = useState<NewScriptForm>(DEFAULT_FORM);
  const [createMode, setCreateMode] = useState<CreateMode>('blank');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof NewScriptForm>(
    key: K,
    value: NewScriptForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 参数合理性校验（复用共享工具）
  const hint = validateScriptParams({
    title: form.title,
    genre: form.genre,
    players: form.players,
    duration: form.duration,
    difficulty: form.difficulty,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('请填写剧本标题');
      return;
    }
    setError(null);

    if (createMode === 'ai') {
      // AI 模式：跳转 generate 页并传递参数
      const params = new URLSearchParams({
        title: form.title.trim(),
        genre: form.genre,
        players: String(form.players),
        duration: String(form.duration),
        difficulty: form.difficulty,
        ageRating: form.ageRating,
        writingStyle: form.writingStyle,
        background: form.background.trim(),
        theme: form.theme.trim(),
      });
      router.push(`/generate?${params.toString()}`);
      return;
    }

    // 空白创建模式：创建剧本并跳转编辑器
    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('未登录，请先登录');
        setSubmitting(false);
        return;
      }
      const id = crypto.randomUUID();
      const { error: insertError } = await supabase.from('scripts').insert({
        id,
        author_id: user.id,
        title: form.title.trim(),
        description: '',
        genre: form.genre,
        player_count: form.players,
        duration_hours: form.duration,
        difficulty: form.difficulty,
        background_setting: form.background.trim(),
        core_theme: form.theme.trim(),
        status: 'draft',
        word_count: 0,
      });
      if (insertError) {
        setError(`创建剧本失败：${insertError.message}`);
        setSubmitting(false);
        return;
      }
      setToast('剧本创建成功，正在跳转编辑器…');
      setTimeout(() => router.push(`/editor/${id}`), 600);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '创建剧本时发生未知错误',
      );
      setSubmitting(false);
    }
  };

  return (
    <section className="scripts-new-view">
      {/* ===== 页头 ===== */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            新建剧本 <span className="seal">草稿</span>
          </h1>
          <div className="page-desc">
            // 选择创建方式 · 填写基础信息 · 进入编辑器或 AI 生成
          </div>
        </div>
        <div className="page-actions">
          <Link href="/scripts" className="btn btn-ghost">
            <ArrowLeft size={14} />
            返回列表
          </Link>
        </div>
      </div>

      <div className="new-script-layout">
        {/* ===== 左栏：创建方式 + 表单 ===== */}
        <div className="new-script-left">
          {/* 创建方式选择 */}
          <div className="create-mode-group">
            <div
              className={`create-mode-card ${createMode === 'blank' ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setCreateMode('blank')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCreateMode('blank');
                }
              }}
            >
              <div className="cm-icon">
                <FileText size={18} />
              </div>
              <div className="cm-title">空白创建</div>
              <div className="cm-desc">填写基础信息，直接进入编辑器手动创作</div>
            </div>
            <div
              className={`create-mode-card ${createMode === 'ai' ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setCreateMode('ai')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCreateMode('ai');
                }
              }}
            >
              <div className="cm-icon">
                <Sparkles size={18} />
              </div>
              <div className="cm-title">AI 智能生成</div>
              <div className="cm-desc">携带参数跳转生成页，由 AI 创作全本</div>
            </div>
          </div>

          {/* 表单卡片 */}
          <div className="card script-form-card">
            <div className="card-head">
              <h3>
                <PenLine size={16} />
                基础信息
              </h3>
            </div>
            <form className="card-body script-form" onSubmit={handleSubmit}>
              {/* 标题 */}
              <div className="form-group">
                <label className="form-label" htmlFor="sf-title">
                  剧本标题 <span className="req">*</span>
                </label>
                <input
                  id="sf-title"
                  className="form-input"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="如：古镇迷案"
                  maxLength={50}
                  required
                />
              </div>

              {/* 题材 */}
              <div className="form-group">
                <label className="form-label">
                  题材 <span className="req">*</span>
                </label>
                <div className="chip-group">
                  {GENRE_OPTIONS.map((g) => (
                    <span
                      key={g.value}
                      className={`chip ${form.genre === g.value ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => update('genre', g.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          update('genre', g.value);
                        }
                      }}
                    >
                      {g.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* 人数 + 时长 */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="sf-players">
                    玩家人数 <span className="req">*</span>
                  </label>
                  <select
                    id="sf-players"
                    className="form-select"
                    value={form.players}
                    onChange={(e) => update('players', Number(e.target.value))}
                  >
                    {[4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} 人
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="sf-duration">
                    预计时长 <span className="req">*</span>
                  </label>
                  <select
                    id="sf-duration"
                    className="form-select"
                    value={form.duration}
                    onChange={(e) => update('duration', Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} 小时
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 难度 */}
              <div className="form-group">
                <label className="form-label">
                  难度 <span className="req">*</span>
                </label>
                <div className="chip-group">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <span
                      key={d.value}
                      className={`chip ${form.difficulty === d.value ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => update('difficulty', d.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          update('difficulty', d.value);
                        }
                      }}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* 适龄分级（新增） */}
              <div className="form-group">
                <label className="form-label" htmlFor="sf-age">
                  适龄分级
                </label>
                <select
                  id="sf-age"
                  className="form-select"
                  value={form.ageRating}
                  onChange={(e) => update('ageRating', e.target.value as AgeRating)}
                >
                  {AGE_RATING_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 写作风格（新增） */}
              <div className="form-group">
                <label className="form-label" htmlFor="sf-style">
                  写作风格
                </label>
                <select
                  id="sf-style"
                  className="form-select"
                  value={form.writingStyle}
                  onChange={(e) =>
                    update('writingStyle', e.target.value as WritingStyle)
                  }
                >
                  {WRITING_STYLE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* 背景设定 */}
              <div className="form-group">
                <label className="form-label" htmlFor="sf-bg">
                  背景设定
                </label>
                <input
                  id="sf-bg"
                  className="form-input"
                  value={form.background}
                  onChange={(e) => update('background', e.target.value)}
                  placeholder="如：清末民初 · 江南古镇"
                  maxLength={100}
                />
              </div>

              {/* 核心立意 */}
              <div className="form-group">
                <label className="form-label" htmlFor="sf-theme">
                  核心立意
                </label>
                <input
                  id="sf-theme"
                  className="form-input"
                  value={form.theme}
                  onChange={(e) => update('theme', e.target.value)}
                  placeholder="如：家国亲情 · 旧恨新仇"
                  maxLength={100}
                />
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="script-form-error" role="alert">
                  {error}
                </div>
              )}

              {/* 提交按钮 */}
              <div className="script-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !form.title.trim()}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : null}
                  {submitting
                    ? '创建中…'
                    : createMode === 'blank'
                      ? '创建并进入编辑器'
                      : '携带参数跳转生成页'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => router.back()}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ===== 右栏：提示预览 ===== */}
        <div className="new-script-right">
          <div className="hint-panel">
            <h4>参数预览</h4>
            {/* 参数汇总预览 */}
            <div className="param-preview">
              <div className="pp-row">
                <span className="pp-key">TITLE</span>
                <span className="pp-val">{form.title || '未填写'}</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">GENRE</span>
                <span className="pp-val">{GENRE_LABEL[form.genre]}</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">PLAYERS</span>
                <span className="pp-val">{form.players} 人</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">DURATION</span>
                <span className="pp-val">{form.duration} 小时</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">DIFFICULTY</span>
                <span className="pp-val">{DIFFICULTY_LABEL[form.difficulty]}</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">AGE RATING</span>
                <span className="pp-val">{AGE_RATING_LABEL[form.ageRating]}</span>
              </div>
              <div className="pp-row">
                <span className="pp-key">STYLE</span>
                <span className="pp-val">{form.writingStyle}</span>
              </div>
            </div>

            <div className="hint-divider">❖</div>

            <h4>合理性提示</h4>
            {/* 校验提示：有提示显示警告，无提示显示通过 */}
            {hint ? (
              <div className="hint-item hint-warn">
                <AlertCircle size={14} />
                <span>{hint}</span>
              </div>
            ) : (
              <div className="hint-item">
                <CheckCircle2 size={14} />
                <span>参数组合合理，可继续创作</span>
              </div>
            )}

            {createMode === 'ai' && (
              <>
                <div className="hint-divider">❖</div>
                <h4>AI 生成说明</h4>
                <div className="hint-item">
                  <Sparkles size={14} />
                  <span>
                    跳转生成页后，参数将自动填充到表单，可直接点击&ldquo;开始生成&rdquo;调用 AI 创作全本。
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="new-script-toast">{toast}</div>}
    </section>
  );
}
