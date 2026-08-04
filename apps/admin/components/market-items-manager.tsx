"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Loader2, Pencil, Plus, Search, Trash2, Upload, X, XCircle } from "lucide-react";
import { Tag } from "@/components/admin-static";
import {
  deleteMarketItemAction,
  saveMarketItemAction,
  toggleMarketItemActiveAction,
} from "@/app/(admin)/market/actions";
import type { AdminMarketItem, MarketItemType } from "@/lib/services/market-items";

const TYPE_OPTIONS: Array<{ value: MarketItemType; label: string }> = [
  { value: "cover", label: "剧本封面" },
  { value: "scene", label: "场景插画" },
  { value: "clue", label: "线索卡插画" },
  { value: "public", label: "公共线插画" },
  { value: "char", label: "人物立绘" },
  { value: "poster", label: "宣传海报" },
];

const TYPE_TAG_TONE: Record<MarketItemType, "default" | "success" | "warning" | "error" | "info" | "purple"> = {
  cover: "purple",
  scene: "info",
  clue: "success",
  public: "default",
  char: "warning",
  poster: "error",
};

function typeLabel(type: MarketItemType) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

/** 素材图片可能存的是 web 端相对路径（/market/xxx.png），admin 预览时需拼上 web 域名 */
const WEB_APP_URL = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").replace(/\/$/, "");

function resolveThumbUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("/") && WEB_APP_URL) return `${WEB_APP_URL}${url}`;
  return url;
}

type Props = {
  initialItems: AdminMarketItem[];
  loadError?: string;
};

export function MarketItemsManager({ initialItems, loadError }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminMarketItem | "new" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [feedbackLeaving, setFeedbackLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  // 操作结果提示：3.2s 后淡出，与全局 AdminToast 一致
  useEffect(() => {
    if (!feedback) return;
    setFeedbackLeaving(false);
    const fadeTimer = setTimeout(() => setFeedbackLeaving(true), 3200);
    const removeTimer = setTimeout(() => setFeedback(null), 3560);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [feedback]);

  // 搜索筛选
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MarketItemType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (typeFilter !== "all" && item.taskType !== typeFilter) return false;
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!q) return true;
      return [item.title, item.subtitle, item.source, item.promptHint]
        .join("\n")
        .toLowerCase()
        .includes(q);
    });
  }, [initialItems, keyword, statusFilter, typeFilter]);

  const hasFilter = Boolean(keyword.trim()) || typeFilter !== "all" || statusFilter !== "all";

  const editingItem = editing && editing !== "new" ? editing : null;

  const resetFilters = () => {
    setKeyword("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const runAction = (action: () => Promise<{ error?: string; success?: boolean; message?: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setFeedback({ kind: "error", text: result.error });
      } else {
        setFeedback({ kind: "success", text: result.message ?? "操作成功" });
        setEditing(null);
        router.refresh();
      }
    });
  };

  const handleSubmit = (formData: FormData) => {
    runAction(() => saveMarketItemAction(formData));
  };

  const handleDelete = (item: AdminMarketItem) => {
    if (!window.confirm(`确认删除素材「${item.title}」？删除后 web 端素材市场不再展示。`)) return;
    runAction(() => deleteMarketItemAction(item.id));
  };

  const handleToggle = (item: AdminMarketItem) => {
    runAction(() => toggleMarketItemActiveAction(item.id, !item.isActive));
  };

  return (
    <section className="admin-card">
      <div className="market-toolbar">
        <div className="market-toolbar-filters">
          <div className="market-search">
            <Search size={14} />
            <input
              className="input"
              placeholder="搜索标题、描述或来源"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            {keyword && (
              <button className="market-search-clear" type="button" onClick={() => setKeyword("")} aria-label="清空搜索">
                <X size={13} />
              </button>
            )}
          </div>
          <select
            className="select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "all" | MarketItemType)}
          >
            <option value="all">全部类型</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">全部状态</option>
            <option value="active">已上架</option>
            <option value="inactive">已下架</option>
          </select>
          {hasFilter && (
            <button className="link-btn" type="button" onClick={resetFilters}>
              重置
            </button>
          )}
        </div>
        <div className="market-toolbar-side">
          <span className="placeholder-meta">
            {hasFilter ? `筛选出 ${filteredItems.length} / ${initialItems.length} 条` : `共 ${initialItems.length} 条素材`}
          </span>
          <button className="admin-btn primary market-add-btn" type="button" onClick={() => setEditing("new")}>
            <Plus size={14} />
            新增素材
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`toast ${feedback.kind === "success" ? "toast-success" : "toast-error"}${feedbackLeaving ? " admin-toast-leaving" : ""}`}
          role="status"
        >
          {feedback.kind === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button
            aria-label="关闭提示"
            className="toast-close"
            type="button"
            onClick={() => setFeedbackLeaving(true)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loadError && (
        <div className="admin-inline-alert" role="alert">
          {loadError}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>预览</th>
              <th>标题 / 描述</th>
              <th>类型</th>
              <th>来源</th>
              <th>排序</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.thumbUrl ? (
                    <button
                      className="market-thumb-btn"
                      type="button"
                      title="点击放大查看"
                      onClick={() => setLightbox({ url: resolveThumbUrl(item.thumbUrl), title: item.title })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveThumbUrl(item.thumbUrl)} alt={item.title} />
                    </button>
                  ) : (
                    <span className="placeholder-meta">无图</span>
                  )}
                </td>
                <td>
                  <div>
                    <b>{item.title}</b>
                    <div className="placeholder-meta">{item.subtitle || item.promptHint.slice(0, 40)}</div>
                  </div>
                </td>
                <td>
                  <Tag tone={TYPE_TAG_TONE[item.taskType]}>{typeLabel(item.taskType)}</Tag>
                </td>
                <td>{item.source || <span className="placeholder-meta">—</span>}</td>
                <td>{item.sortOrder}</td>
                <td>{item.isActive ? <Tag tone="success">已上架</Tag> : <Tag>已下架</Tag>}</td>
                <td>
                  <div className="row-actions">
                    <button className="link-btn" type="button" onClick={() => setEditing(item)}>
                      <Pencil size={12} style={{ verticalAlign: -1, marginRight: 2 }} />
                      编辑
                    </button>
                    <button className="link-btn" type="button" onClick={() => handleToggle(item)}>
                      {item.isActive ? "下架" : "上架"}
                    </button>
                    <button className="link-btn" type="button" onClick={() => handleDelete(item)}>
                      <Trash2 size={12} style={{ verticalAlign: -1, marginRight: 2 }} />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={7}>
                  {hasFilter ? "没有匹配筛选条件的素材" : "暂无素材，点击「新增素材」创建"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => !pending && setEditing(null)}>
          <div className="modal market-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">{editingItem ? "编辑素材" : "新增素材"}</span>
              <button className="link-btn" type="button" onClick={() => setEditing(null)} disabled={pending}>
                关闭
              </button>
            </div>
            <MarketItemForm
              key={editingItem?.id ?? "new"}
              item={editingItem}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}
      {lightbox && (
        <div className="market-lightbox" onClick={() => setLightbox(null)}>
          <button className="market-lightbox-close" type="button" aria-label="关闭预览">
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.title} onClick={(event) => event.stopPropagation()} />
          <div className="market-lightbox-caption">{lightbox.title}</div>
        </div>
      )}
    </section>
  );
}

type MarketItemFormProps = {
  item: AdminMarketItem | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
};

function MarketItemForm({ item, pending, onCancel, onSubmit }: MarketItemFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const currentImageUrl = item?.thumbUrl ? resolveThumbUrl(item.thumbUrl) : "";
  const shownImageUrl = previewUrl || currentImageUrl;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form action={onSubmit}>
      <div className="modal-body market-modal-body">
        <div className="market-form">
          {item && <input type="hidden" name="id" value={item.id} />}

          <div className="market-form-row">
            <label className="form-item">
              <span className="form-label required">标题</span>
              <input className="input" name="title" required defaultValue={item?.title ?? ""} />
            </label>

            <label className="form-item">
              <span className="form-label required">类型</span>
              <select className="select" name="taskType" defaultValue={item?.taskType ?? "cover"}>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="market-form-row">
            <label className="form-item">
              <span className="form-label">来源（如《那一束月光3》）</span>
              <input className="input" name="source" defaultValue={item?.source ?? ""} />
            </label>

            <label className="form-item">
              <span className="form-label">排序（越小越靠前）</span>
              <input
                className="input"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={item?.sortOrder ?? 0}
              />
            </label>
          </div>

          <label className="form-item">
            <span className="form-label">描述（非必要）</span>
            <input className="input" name="subtitle" defaultValue={item?.subtitle ?? ""} />
          </label>

          <label className="form-item">
            <span className="form-label required">提示词参考</span>
            <textarea
              className="input"
              name="promptHint"
              required
              rows={3}
              defaultValue={item?.promptHint ?? ""}
            />
          </label>

          <label className="form-item">
            <span className="form-label">风格基调</span>
            <input
              className="input"
              name="visualTone"
              placeholder="如：黑白手绘 / 高对比 / 对称构图 / 压迫氛围"
              defaultValue={item?.visualTone ?? ""}
            />
          </label>

          <div className="form-item">
            <span className="form-label">
              <ImagePlus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              素材图片
            </span>

            {/* 保留原图地址：不上传新文件时服务端沿用该值 */}
            <input type="hidden" name="thumbUrl" value={item?.thumbUrl ?? ""} />

            <div className="market-upload">
              {shownImageUrl ? (
                <div className="market-upload-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shownImageUrl} alt={item?.title ?? "素材图片预览"} />
                  <span className="placeholder-meta">{previewUrl ? "新图片预览" : "当前图片"}</span>
                </div>
              ) : (
                <div className="market-upload-preview empty">
                  <ImagePlus size={22} />
                  <span className="placeholder-meta">暂未设置图片</span>
                </div>
              )}

              <div className="market-upload-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="image"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  className="admin-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                >
                  <Upload size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                  {shownImageUrl ? "更换图片" : "选择图片"}
                </button>
                <span className="placeholder-meta">
                  {selectedFile ? selectedFile.name : "支持 PNG / JPG / WebP，不超过 10MB"}
                </span>
                {selectedFile && (
                  <button className="link-btn" type="button" onClick={handleClearFile} disabled={pending}>
                    取消选择
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" name="isActive" defaultChecked={item?.isActive ?? true} />
            上架
          </label>
        </div>
      </div>

      <div className="modal-foot">
        <button className="admin-btn" type="button" onClick={onCancel} disabled={pending}>
          取消
        </button>
        <button className="admin-btn primary" type="submit" disabled={pending}>
          {pending && <Loader2 size={14} className="spin" style={{ verticalAlign: -2, marginRight: 4 }} />}
          {item ? "保存修改" : "创建素材"}
        </button>
      </div>
    </form>
  );
}
