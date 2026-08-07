/**
 * API 路由统一认证与授权 helper
 *
 * 模式对齐 /api/generate/[phase] 的 resolveAuthenticatedUser：
 * 1. 优先解析 Authorization: Bearer <token>（无状态，供 fetch 调用）
 * 2. 兜底读取服务端会话 cookie
 * 3. 返回 { id, isBanned } 或 null（未登录）
 *
 * 所有走 service_role（绕过 RLS）的 API 路由必须用它做认证，
 * 并对按剧本操作的路由追加 isScriptOwnedByUser 所有权校验。
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface AuthenticatedUser {
  id: string;
  isBanned: boolean;
}

/**
 * 解析当前请求用户。
 * 优先头部 Bearer token，其次会话 cookie。
 * 未登录返回 null；已登录返回用户 id 与封禁状态。
 */
export async function resolveAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token && SUPABASE_URL && ANON_KEY) {
    const supabase = createSupabaseClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) {
      return { id: user.id, isBanned: await checkUserBanned(user.id) };
    }
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, isBanned: await checkUserBanned(user.id) };
}

/** 校验用户是否被封禁（查询失败按未封禁处理，避免 DB 故障阻塞所有请求） */
async function checkUserBanned(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("is_banned")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      console.warn(
        `Failed to check is_banned for user ${userId}: ${error?.message ?? "no row"}`,
      );
      return false;
    }
    return data.is_banned === true;
  } catch {
    return false;
  }
}

/**
 * 校验某个剧本是否属于当前用户。
 * 剧本不存在同样返回 false（避免暴露存在性）。
 */
export async function isScriptOwned(
  scriptId: string,
  userId: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("scripts")
      .select("author_id")
      .eq("id", scriptId)
      .maybeSingle();
    if (error || !data) return false;
    return data.author_id === userId;
  } catch {
    return false;
  }
}