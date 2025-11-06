import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ServerSupabaseClient = SupabaseClient | null;

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

let serverClient: ServerSupabaseClient;

export const getSupabaseServerClient = (): ServerSupabaseClient => {
  if (serverClient) {
    return serverClient;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Supabase server credentials are missing. Persistence actions will be skipped.",
      );
    }
    serverClient = null;
    return serverClient;
  }

  serverClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return serverClient;
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseServiceRoleKey);

export type { SupabaseClient };
