import { createClient } from "@supabase/supabase-js";
import { dbFetch, trace } from "@/lib/trace";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // In development with TRACE_LOG=1, every database call is recorded
    trace.enabled ? { global: { fetch: dbFetch } } : undefined
  );
}
