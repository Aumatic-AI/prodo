import type { SupabaseClient } from "@supabase/supabase-js";

// The website scan: started on the first screen, it reads the site while the client answers
// "Your content", and fills Basics and the products or services with what it finds.
// Kept in business_profile.onboarding.scan; the job writes it one key at a time (set_scan_state).

export interface ScanState {
  /** agent_runs.run_id of the scan's steps */
  id: string;
  website: string;
  state: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Basics fields filled from the website, shown with a "Filled from your website" badge */
  filled?: string[];
  /** Products the site lists as sold out; left out until the client adds them */
  soldOut?: string[];
}

/** A scan that logged nothing for this long has stopped (e.g. the job server was down). */
export const SCAN_STALE_AFTER_MS = 10 * 60_000;

export function newScan(website: string): ScanState {
  return { id: crypto.randomUUID(), website, state: "running", startedAt: new Date().toISOString() };
}

/** True when the scan is still worth waiting for. */
export function scanRunning(scan: ScanState | null | undefined): scan is ScanState {
  return !!scan && scan.state === "running" && Date.now() - Date.parse(scan.startedAt) < SCAN_STALE_AFTER_MS;
}

/** True when a finished scan already read this website (the research can skip reading it again). */
export function scannedSite(scan: ScanState | null | undefined, website: string | null): boolean {
  return !!scan && scan.state === "done" && !!website && scan.website === website;
}

/** One key of the scan state. Service role only (the scan job). */
export async function setScanState(db: SupabaseClient, key: keyof ScanState, value: unknown): Promise<void> {
  const { error } = await db.rpc("set_scan_state", { path: [key], value });
  if (error) throw error;
}

export async function readScan(db: SupabaseClient): Promise<ScanState | null> {
  const { data, error } = await db.from("business_profile").select("onboarding").single();
  if (error) throw error;
  return data.onboarding?.scan ?? null;
}
