import type { SupabaseClient } from "@supabase/supabase-js";
import { newScan, scanRunning, type ScanState } from "./scan";
import { saveProgress } from "./sync";

/**
 * Saves the website from the start screen and sets up a scan of it. Returns the scan to start,
 * or null when there's nothing new to read (no website, or this site is already being read or was read).
 */
export async function saveWebsite(db: SupabaseClient, website: string): Promise<ScanState | null> {
  const { data, error } = await db.from("business_profile").select("onboarding").single();
  if (error) throw error;
  const current: ScanState | undefined = data.onboarding?.scan;
  const sameSite = current?.website === website && (current.state === "done" || scanRunning(current));
  const scan = website && !sameSite ? newScan(website) : null;

  await saveProgress(db, "content", { website: website || null }, scan ? { scan } : {});
  return scan;
}
