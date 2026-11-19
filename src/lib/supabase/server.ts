import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { PICKED_BUSINESS_COOKIE, PICKED_BUSINESS_HEADER, TAB_BUSINESS_HEADER, isBusinessId } from "@/lib/active-business";

export async function createClient() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  // Which of the login's businesses this request is for: the tab's (API calls) or the one picked on this device
  // (page loads). The database checks the login belongs to it (current_business_id(), migration 0030)
  const tab = requestHeaders.get(TAB_BUSINESS_HEADER);
  const picked = cookieStore.get(PICKED_BUSINESS_COOKIE)?.value;
  const business: Record<string, string> = {
    ...(tab ? { [TAB_BUSINESS_HEADER]: tab } : {}),
    ...(isBusinessId(picked) ? { [PICKED_BUSINESS_HEADER]: picked } : {}),
  };
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            );
          } catch {
            // Server component — ignore
          }
        },
      },
      global: { headers: business },
    }
  );
}
