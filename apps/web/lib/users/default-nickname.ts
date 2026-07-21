import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_NICKNAME_PREFIX = "叙光 - ";
const DEFAULT_NICKNAME_RETRY_LIMIT = 8;

export async function createDefaultNickname(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < DEFAULT_NICKNAME_RETRY_LIMIT; attempt += 1) {
    const nickname = `${DEFAULT_NICKNAME_PREFIX}${createEightDigitNumber()}`;
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (!error && !data) {
      return nickname;
    }
  }

  return `${DEFAULT_NICKNAME_PREFIX}${Date.now().toString().slice(-8)}`;
}

export function isDefaultNicknameConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const conflict = error as { code?: string; message?: string; details?: string };

  return (
    conflict.code === "23505" &&
    `${conflict.message ?? ""} ${conflict.details ?? ""}`.includes("idx_users_default_nickname_unique")
  );
}

function createEightDigitNumber(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000;
  return value.toString().padStart(8, "0");
}
