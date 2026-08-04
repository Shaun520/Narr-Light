import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type MarketItemType = "cover" | "scene" | "clue" | "public" | "char" | "poster";

export type AdminMarketItem = {
  id: string;
  title: string;
  taskType: MarketItemType;
  subtitle: string;
  promptHint: string;
  visualTone: string;
  thumbUrl: string;
  source: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MarketItemInput = {
  title: string;
  taskType: MarketItemType;
  subtitle: string;
  promptHint: string;
  visualTone: string;
  thumbUrl: string;
  source: string;
  sortOrder: number;
  isActive: boolean;
};

const MARKET_BUCKET = "illustration-assets";

type MarketRow = {
  id: string;
  title: string;
  task_type: MarketItemType;
  subtitle: string | null;
  prompt_hint: string | null;
  visual_tone: string | null;
  thumb_url: string | null;
  source: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

export async function listMarketItems(): Promise<{ items: AdminMarketItem[]; error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { items: [], error: "未配置 Supabase service role，无法读取素材市场数据。" };
  }

  const { data, error } = await supabase
    .from("illustration_market_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<MarketRow[]>();

  if (error) {
    return { items: [], error: `读取素材市场失败：${error.message}` };
  }

  return { items: (data ?? []).map(mapRow) };
}

export async function createMarketItem(
  input: MarketItemInput,
): Promise<{ error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "未配置 Supabase service role。" };

  const { error } = await supabase.from("illustration_market_items").insert({
    title: input.title,
    task_type: input.taskType,
    subtitle: input.subtitle,
    prompt_hint: input.promptHint,
    visual_tone: input.visualTone,
    thumb_url: input.thumbUrl,
    source: input.source,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  });

  return error ? { error: `新增素材失败：${error.message}` } : {};
}

export async function updateMarketItem(
  id: string,
  input: MarketItemInput,
): Promise<{ error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "未配置 Supabase service role。" };

  const { error } = await supabase
    .from("illustration_market_items")
    .update({
      title: input.title,
      task_type: input.taskType,
      subtitle: input.subtitle,
      prompt_hint: input.promptHint,
      visual_tone: input.visualTone,
      thumb_url: input.thumbUrl,
      source: input.source,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return error ? { error: `更新素材失败：${error.message}` } : {};
}

export async function deleteMarketItem(id: string): Promise<{ error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "未配置 Supabase service role。" };

  const { error } = await supabase.from("illustration_market_items").delete().eq("id", id);
  return error ? { error: `删除素材失败：${error.message}` } : {};
}

export async function setMarketItemActive(
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "未配置 Supabase service role。" };

  const { error } = await supabase
    .from("illustration_market_items")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  return error ? { error: `更新上架状态失败：${error.message}` } : {};
}

/** 上传素材图片到 Supabase Storage（公开桶），返回可访问 URL */
export async function uploadMarketImage(file: File): Promise<{ url?: string; error?: string }> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { error: "未配置 Supabase service role。" };

  if (!file.type.startsWith("image/")) {
    return { error: "仅支持上传图片文件" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "图片大小不能超过 10MB" };
  }

  const bucketError = await ensureBucket();
  if (bucketError) return { error: bucketError };

  const ext = extensionFromType(file.type);
  const path = `market/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(MARKET_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return { error: `上传素材图片失败：${error.message}` };
  }

  const { data } = supabase.storage.from(MARKET_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

async function ensureBucket(): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return "未配置 Supabase service role。";

  const { error } = await supabase.storage.getBucket(MARKET_BUCKET);
  if (!error) return null;

  const { error: createError } = await supabase.storage.createBucket(MARKET_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });
  return createError ? `初始化图片存储桶失败：${createError.message}` : null;
}

function extensionFromType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function mapRow(row: MarketRow): AdminMarketItem {
  return {
    id: row.id,
    title: row.title,
    taskType: row.task_type,
    subtitle: row.subtitle ?? "",
    promptHint: row.prompt_hint ?? "",
    visualTone: row.visual_tone ?? "",
    thumbUrl: row.thumb_url ?? "",
    source: row.source ?? "",
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
