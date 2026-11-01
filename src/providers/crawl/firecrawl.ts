import { env } from "@/config/env";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { cleanReason, quoted, statusText } from "@/core/error-text";
import { jsonOrThrow, replyError, request, shortUrl, type KnownErrors } from "@/providers/http";
import type { Result } from "@/providers/usage";

const SERVICE = "Firecrawl";
const API_BASE = "https://api.firecrawl.dev/v2";

export interface PageLink {
  url: string;
  title?: string;
}

export interface ScrapedPage {
  url: string;
  title?: string;
  markdown: string;
  html?: string;
  /** Full page source with head, styles and links (for colours and fonts) */
  rawHtml?: string;
  screenshotUrl?: string;
}

export interface CrawlStatus {
  status: "scraping" | "completed" | "failed";
  pages: ScrapedPage[];
}

function headers() {
  if (!env.FIRECRAWL_API_KEY) throw notConfigured(SERVICE, "FIRECRAWL_API_KEY is empty on the server");
  return { "Content-Type": "application/json", Authorization: `Bearer ${env.FIRECRAWL_API_KEY}` };
}

// Its documented error codes (docs.firecrawl.dev/api-reference/errors and its open-source server).
// Errors look like {success: false, error, code?}; some come inside a 200.
const KNOWN: KnownErrors = {
  insufficient_credits: { say: "it's out of credit", type: "OUT_OF_CREDIT", retry: false },
  UNSUPPORTED_SITE: { say: "it doesn't read this website (Firecrawl blocks it)", type: "INVALID_INPUT", retry: false },
  SAFE_MODE_BLOCKED: { say: "it blocked this website for safety", type: "INVALID_INPUT", retry: false },
  unsafe_domain_blocked: { say: "it blocked this website for safety", type: "INVALID_INPUT", retry: false },
  SCRAPE_SITE_RESTRICTION_BLOCKED: { say: "it isn't allowed to read this website", type: "INVALID_INPUT", retry: false },
  SCRAPE_PROMPT_INJECTION_DETECTED: { say: "it found hidden instructions on the page and stopped", type: "CONTENT_BLOCKED", retry: false },
  SCRAPE_TIMEOUT: { say: "the page took too long to load", type: "TIMEOUT", retry: true },
  MAP_TIMEOUT: { say: "listing the website's pages took too long", type: "TIMEOUT", retry: true },
  CONCURRENCY_QUEUE_TIMEOUT: { say: "it waited too long for a free browser (more pages at once than the plan allows)", type: "TIMEOUT", retry: true },
  SCRAPE_ALL_ENGINES_FAILED: {
    say: "none of its browsers could load the page (a wrong address, a site that blocks bots, a site that's down, or a page behind a login)",
    type: "PROVIDER_DOWN",
    retry: true,
  },
  SCRAPE_SITE_ERROR: { say: "the website had a network error", type: "PROVIDER_DOWN", retry: true },
  SCRAPE_DNS_RESOLUTION_ERROR: { say: "the website's address doesn't exist (DNS lookup failed)", type: "INVALID_INPUT", retry: false },
  SCRAPE_SSL_ERROR: { say: "the website's security certificate is broken", type: "INVALID_INPUT", retry: false },
  SCRAPE_UNSUPPORTED_FILE_ERROR: { say: "it can't read this kind of file", type: "INVALID_INPUT", retry: false },
  BAD_REQUEST: { say: "it didn't accept the request", type: "INVALID_INPUT", retry: false },
  UNKNOWN_ERROR: { say: "it had an unexpected error on its side", type: "PROVIDER_DOWN", retry: true },
};
// Older replies say it without a code
const BY_MESSAGE: [RegExp, string][] = [
  [/do not support this site|no longer supported/i, "UNSUPPORTED_SITE"],
  [/insufficient credits/i, "insufficient_credits"],
];

/** `what` names the work in error messages: "reading royal-gypsy.com/about" */
async function post(path: string, body: unknown, what: string): Promise<any> {
  const res = await request(SERVICE, `${API_BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const text = await res.text().catch(() => "");
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    if (res.ok) throw new AppError(`${SERVICE} (${what}) sent a reply that isn't JSON: "${cleanReason(text, 120)}".`, "PROVIDER_DOWN", true);
  }
  if (!res.ok || data?.success === false) throw replyError(SERVICE, res, data, text, what, KNOWN, BY_MESSAGE);
  return data;
}

/**
 * The page itself answered with an error (Firecrawl reached it, the website said no): its error page
 * isn't the page's content, so it isn't passed on as if it were.
 */
function pageError(url: string, d: any): AppError | null {
  const status = Number(d?.metadata?.statusCode);
  if (!(status >= 400)) return null;
  const where = shortUrl(d?.metadata?.sourceURL ?? url);
  return new AppError(`${where} answered ${statusText(status)} when Firecrawl read it${quoted(d?.metadata?.error)}.`, status >= 500 ? "PROVIDER_DOWN" : "INVALID_INPUT", status >= 500);
}

function usage(pages: number) {
  return { provider: "firecrawl", costUsd: pages * PRICING.firecrawl.perPage };
}

function toPage(d: any): ScrapedPage {
  return {
    url: d.metadata?.sourceURL ?? d.metadata?.url ?? d.url ?? "",
    title: d.metadata?.title,
    markdown: d.markdown ?? "",
    html: d.html,
    rawHtml: d.rawHtml,
    screenshotUrl: d.screenshot,
  };
}

/** Every URL on the site, without scraping them. */
export async function map(url: string, limit = 200): Promise<Result<PageLink[]>> {
  const data = await post("/map", { url, limit }, `listing the pages of ${shortUrl(url)}`);
  const links: PageLink[] = (data.links ?? []).map((l: any) => (typeof l === "string" ? { url: l } : { url: l.url, title: l.title }));
  return { data: links, usage: usage(1) };
}

export interface ScrapeOptions {
  html?: boolean;
  /** Full page source and a screenshot of the whole page (no main-content trimming) */
  design?: boolean;
}

export async function scrape(url: string, opts: ScrapeOptions = {}): Promise<Result<ScrapedPage>> {
  const formats = opts.design ? ["markdown", "rawHtml", "screenshot"] : opts.html ? ["markdown", "html"] : ["markdown"];
  const data = await post("/scrape", { url, onlyMainContent: !opts.design, formats }, `reading ${shortUrl(url)}`);
  const failed = pageError(url, data.data);
  if (failed) throw failed;
  return { data: toPage(data.data ?? {}), usage: usage(1) };
}

export async function screenshot(url: string): Promise<Result<string | undefined>> {
  const data = await post("/scrape", { url, formats: ["screenshot"] }, `taking a screenshot of ${shortUrl(url)}`);
  const failed = pageError(url, data.data);
  if (failed) throw failed;
  return { data: data.data?.screenshot, usage: usage(1) };
}

/** Starts a crawl. Poll crawlStatus with the returned id. */
export async function startCrawl(url: string, limit: number): Promise<string> {
  const data = await post("/crawl", { url, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }, `starting to read ${shortUrl(url)}`);
  return data.id;
}

export async function crawlStatus(id: string): Promise<Result<CrawlStatus>> {
  const res = await request(SERVICE, `${API_BASE}/crawl/${encodeURIComponent(id)}`, { headers: headers() });
  const data = await jsonOrThrow(SERVICE, res, undefined, "checking how the site reading is going", KNOWN);
  // A crawl that failed outright (e.g. Firecrawl's queue was full when it started) says so here
  if (data?.status === "failed" && !(data.data ?? []).length) {
    throw new AppError(`${SERVICE}: reading the website failed before any page was read${quoted(data.error)}.`, "PROVIDER_DOWN", true);
  }
  const pages = (data.data ?? []).map(toPage);
  const status = data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "scraping";
  return { data: { status, pages }, usage: usage(status === "completed" ? pages.length : 0) };
}
