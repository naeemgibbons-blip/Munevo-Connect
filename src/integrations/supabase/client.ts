import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables"
  );
}

// Untyped client: src/integrations/supabase/types.ts provides hand-written
// row types for component-level use instead of the strict Database generic,
// since this project has no linked Supabase project to codegen against yet.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
