"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createMarketItem,
  deleteMarketItem,
  setMarketItemActive,
  updateMarketItem,
  uploadMarketImage,
  type MarketItemInput,
  type MarketItemType,
} from "@/lib/services/market-items";

export type MarketActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

const VALID_TYPES: MarketItemType[] = ["cover", "scene", "clue", "public", "char", "poster"];

export async function saveMarketItemAction(formData: FormData): Promise<MarketActionResult> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const taskTypeRaw = String(formData.get("taskType") ?? "").trim();
    const taskType = VALID_TYPES.includes(taskTypeRaw as MarketItemType)
      ? (taskTypeRaw as MarketItemType)
      : null;
    const promptHint = String(formData.get("promptHint") ?? "").trim();

    if (!title) return { error: "标题不能为空" };
    if (!taskType) return { error: "素材类型不合法" };
    if (!promptHint) return { error: "提示词参考不能为空" };

    // 图片：优先使用新上传的文件，其次保留/使用手动填写的 URL
    let thumbUrl = String(formData.get("thumbUrl") ?? "").trim();
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      const uploaded = await uploadMarketImage(image);
      if (uploaded.error || !uploaded.url) {
        return { error: uploaded.error ?? "上传素材图片失败" };
      }
      thumbUrl = uploaded.url;
    }

    const input: MarketItemInput = {
      title,
      taskType,
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      promptHint,
      visualTone: String(formData.get("visualTone") ?? "").trim(),
      thumbUrl,
      source: String(formData.get("source") ?? "").trim(),
      sortOrder: Math.max(0, Math.floor(Number(formData.get("sortOrder")) || 0)),
      isActive: formData.get("isActive") === "on",
    };

    const result = id ? await updateMarketItem(id, input) : await createMarketItem(input);
    if (result.error) return { error: result.error };

    revalidatePath("/market");
    return { success: true, message: id ? "素材已更新" : "素材已新增" };
  } catch (error) {
    console.error("[saveMarketItemAction] 保存素材失败:", error);
    return { error: error instanceof Error ? `保存失败：${error.message}` : "保存失败" };
  }
}

export async function deleteMarketItemAction(id: string): Promise<MarketActionResult> {
  try {
    await requireAdmin();
    if (!id) return { error: "素材 ID 不能为空" };

    const result = await deleteMarketItem(id);
    if (result.error) return { error: result.error };

    revalidatePath("/market");
    return { success: true, message: "素材已删除" };
  } catch (error) {
    console.error("[deleteMarketItemAction] 删除素材失败:", error);
    return { error: error instanceof Error ? `删除失败：${error.message}` : "删除失败" };
  }
}

export async function toggleMarketItemActiveAction(
  id: string,
  isActive: boolean,
): Promise<MarketActionResult> {
  try {
    await requireAdmin();
    if (!id) return { error: "素材 ID 不能为空" };

    const result = await setMarketItemActive(id, isActive);
    if (result.error) return { error: result.error };

    revalidatePath("/market");
    return { success: true, message: isActive ? "素材已上架" : "素材已下架" };
  } catch (error) {
    console.error("[toggleMarketItemActiveAction] 更新上架状态失败:", error);
    return { error: error instanceof Error ? `操作失败：${error.message}` : "操作失败" };
  }
}
