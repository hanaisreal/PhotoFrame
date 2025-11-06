import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserSupabaseClient = SupabaseClient | null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: BrowserSupabaseClient;

export const getSupabaseBrowserClient = (): BrowserSupabaseClient => {
  if (browserClient) {
    return browserClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Supabase environment variables are missing. Client features depending on Supabase will be disabled.",
      );
    }
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
};

export type { SupabaseClient };
