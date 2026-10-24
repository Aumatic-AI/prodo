import { env } from "@/config/env";
import { PRICING } from "@/config/pricing";
import { notConfigured } from "@/core/errors";
import { jsonOrThrow, request } from "@/providers/http";
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
  if (!env.FIRECRAWL_API_KEY) throw notConfigured(SERVICE);
  return { "Content-Type": "application/json", Authorization: `Bearer ${env.FIRECRAWL_API_KEY}` };
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await request(SERVICE, `${API_BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  return jsonOrThrow(SERVICE, res, (b) => b?.error);
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
  const data = await post("/map", { url, limit });
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
  const data = await post("/scrape", { url, onlyMainContent: !opts.design, formats });
  return { data: toPage(data.data ?? {}), usage: usage(1) };
}

export async function screenshot(url: string): Promise<Result<string | undefined>> {
  const data = await post("/scrape", { url, formats: ["screenshot"] });
  return { data: data.data?.screenshot, usage: usage(1) };
}

/** Starts a crawl. Poll crawlStatus with the returned id. */
export async function startCrawl(url: string, limit: number): Promise<string> {
  const data = await post("/crawl", { url, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } });
  return data.id;
}

export async function crawlStatus(id: string): Promise<Result<CrawlStatus>> {
  const res = await request(SERVICE, `${API_BASE}/crawl/${encodeURIComponent(id)}`, { headers: headers() });
  const data = await jsonOrThrow(SERVICE, res, (b) => b?.error);
  const pages = (data.data ?? []).map(toPage);
  const status = data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "scraping";
  return { data: { status, pages }, usage: usage(status === "completed" ? pages.length : 0) };
}
