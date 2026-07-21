import "server-only";

import { createClient } from "@supabase/supabase-js";

export type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>;

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || !serviceRoleKey.startsWith("eyJ")) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
