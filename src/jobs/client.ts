import { EventSchemas, Inngest } from "inngest";
import { AppError } from "@/core/errors";
import { cleanReason, isNetworkError, networkReason } from "@/core/error-text";
import type { ResearchAgent } from "@/core/onboarding/research";

// Every event carries the business it is for: functions open the database with businessDb(businessId),
// and per-business limits (concurrency) key on it. The types make a missing businessId a compile error.

type ForBusiness<T extends object = Record<never, never>> = { data: T & { businessId: string } };

type Events = {
  "media/generate-image": ForBusiness<{ mediaId: string; /** Its credits, given back when it fails */ creditKey?: string }>;
  "media/generate-video": ForBusiness<{ mediaId: string; /** Its credits, given back when it fails */ creditKey?: string }>;
  "post/publish": ForBusiness<{ postId: string }>;
  "post/check-status": ForBusiness<{ postId: string; checkAt: string }>;
  "post/cancelled": ForBusiness<{ postId: string }>;
  "media/deleted": ForBusiness<{ mediaId: string }>;
  /** Brand research. `agents` lists which ones to run (all on submit, the unfinished ones on retry). */
  "onboarding/started": ForBusiness<{ runId: string; attempt: string; agents: ResearchAgent[] }>;
  /** Read the website from the first onboarding screen and fill Basics and the products or services */
  "onboarding/scan": ForBusiness<{ scanId: string }>;
  /** One research agent, started by the onboarding run (step.invoke) */
  "research/website-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/visual-identity-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/social-market-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/brand-strategist": ForBusiness<{ runId: string; note?: string | null }>;
  /** New Brand Bible draft from the same research, following the client's note */
  "brand/regenerate": ForBusiness<{ runId: string; note: string | null; /** Its credits, given back when it fails */ creditKey?: string }>;
  /** The client added their own video in Brand → Assets: watch it for usable moments */
  "brand/footage-added": ForBusiness;
  /** A Brand Bible version was approved */
  "brand/approved": ForBusiness<{ bibleId: string; version: number }>;

  // ---------- Weekly loop ----------
  /** Hourly from the cron, per business: plan next week if it's the business's plan day and hour */
  "plan/check-due": ForBusiness;
  /**
   * Plan the week starting on weekStart (Monday, "YYYY-MM-DD"); from the weekly cron or "Plan next week".
   * With `batch` ("Auto-create"): that many posts of each kind over the next days instead (weekStart is the week of the first one),
   * `format` null = follow the client's content mix.
   */
  "plan/requested": ForBusiness<{ weekStart: string; replace?: boolean; source: "cron" | "client" | "onboarding"; batch?: { static: number; carousel: number; video: number; /** One chosen day ("YYYY-MM-DD") for every post; without it the posts spread over the next 7 days */ date?: string } }>;
  /** Make one slot: Creative Director → QA Gate 1 → Producer → QA Gate 2. `note` = the client's regenerate note */
  "plan-item/produce": ForBusiness<{ itemId: string; planId: string; note?: string | null; oneOff?: boolean }>;
  /** A slot finished producing (ready, needs review or failed) */
  "plan-item/settled": ForBusiness<{ itemId: string; planId: string; oneOff?: boolean }>;
  /** Every slot of a plan finished producing and the client was told */
  "plan/review-started": ForBusiness<{ planId: string }>;
  /** The client (or full autopilot) approved a plan: schedule its approved slots */
  "plan/approved": ForBusiness<{ planId: string; auto?: boolean }>;
  /** One slot approved: schedule it */
  "plan-item/approved": ForBusiness<{ itemId: string }>;
  /** Daily metrics and follower counts (from the cron, per business) */
  "performance/sync": ForBusiness;
  /** The weekly learning (from the Sunday cron per business, or "Learn now") */
  "performance/learn": ForBusiness;
  /** Monthly: public holidays and a fresh market read (from the cron, per business) */
  "brand/monthly-refresh": ForBusiness;
  /** The month's fee for connected social accounts (credits) */
  "credits/monthly-fees": ForBusiness;
  /** The pause switch changed: hold or release posts already scheduled with the provider */
  "settings/paused-changed": ForBusiness<{ paused: boolean }>;
  /** A slot was rejected, deleted or replanned: stop work on it */
  "plan-item/cancelled": ForBusiness<{ itemId: string }>;
};

const client = new Inngest({ id: "prodo", schemas: new EventSchemas().fromRecord<Events>() });

/** What a sent event starts, for the message when sending fails */
const STARTS: Partial<Record<keyof Events, string>> = {
  "plan-item/produce": "starting the post's agents",
  "plan-item/approved": "scheduling the post",
  "plan-item/cancelled": "stopping the post's agents",
  "plan-item/settled": "updating the week's plan",
  "plan/requested": "starting the Planner",
  "plan/approved": "starting the approved plan",
  "onboarding/started": "starting the brand research",
  "onboarding/scan": "starting the website scan",
  "brand/regenerate": "rewriting the Brand Bible",
  "brand/approved": "starting the weekly loop",
  "brand/footage-added": "watching the new video",
  "media/generate-image": "starting the image",
  "media/generate-video": "starting the video",
  "media/deleted": "cleaning up the deleted media",
  "performance/learn": "starting the Performance Analyst",
  "post/publish": "publishing the post",
  "post/cancelled": "cancelling the post",
  "settings/paused-changed": "pausing or resuming the agents",
};

/** Where events go: the dev server on this computer (INNGEST_DEV) or Inngest Cloud */
function inngestAddress(): string {
  const dev = process.env.INNGEST_DEV;
  if (process.env.INNGEST_BASE_URL) return process.env.INNGEST_BASE_URL;
  if (dev) return dev.startsWith("http") ? dev : "http://localhost:8288";
  return "Inngest Cloud";
}

/** "Inngest (starting the post's agents) couldn't be reached at http://localhost:8288: the server refused the connection (ECONNREFUSED)…" */
function sendError(err: unknown, payload: unknown): AppError {
  const first = (Array.isArray(payload) ? payload[0] : payload) as { name?: string } | undefined;
  const name = first?.name ?? "";
  const what = STARTS[name as keyof Events] ?? `sending the "${name}" event`;
  if (isNetworkError(err)) {
    const dev = process.env.INNGEST_DEV ? " The Inngest dev server must be running on this computer: npx inngest-cli@latest dev." : "";
    return new AppError(`Inngest (${what}) couldn't be reached at ${inngestAddress()}: ${networkReason(err)}.${dev}`, "PROVIDER_DOWN", true);
  }
  return new AppError(`Inngest (${what}) didn't take the event: ${cleanReason((err as Error)?.message ?? err) || "no reason given"}.`, "PROVIDER_DOWN", true);
}

// Every route that starts a run sends through here, so a failed send names Inngest, what was being
// started and why, instead of fetch's bare "fetch failed"
const send = client.send.bind(client);
client.send = (async (...args: Parameters<typeof send>) => {
  try {
    return await send(...args);
  } catch (err) {
    throw sendError(err, args[0]);
  }
}) as typeof client.send;

export const inngest = client;

export type { Events };
