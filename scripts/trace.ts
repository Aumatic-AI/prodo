// Reads the trace logs in .logs/research (written when TRACE_LOG=1) and turns them into a report.
//
//   npm run trace                    report for the latest run → .logs/research/<run>.html
//   npm run trace -- <run id>        report for one run
//   npm run trace -- --list          list recorded runs
//   npm run trace -- --follow        print events live while a run is going
//   npm run trace -- --out <file>    write the report without the page wrapper (for the artifact)

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIR = path.join(process.cwd(), ".logs", "research");
const VIEWER = path.join(process.cwd(), "scripts", "trace", "viewer.html");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

type Event = Record<string, any> & { ts: number; type: string };

function runs(): { id: string; file: string; mtime: number; size: number }[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const file = path.join(DIR, f);
      const s = statSync(file);
      return { id: f.replace(/\.jsonl$/, ""), file, mtime: s.mtimeMs, size: s.size };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function readEvents(file: string): Event[] {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

const AGENT = { website_analyst: "Website", visual_identity_analyst: "Visual", social_market_analyst: "Social", brand_strategist: "Strategist" } as Record<string, string>;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** One terminal line per event. */
function line(e: Event, t0: number): string | null {
  const at = `+${secs(e.ts - t0).padStart(7)}`;
  const who = `${(AGENT[e.agent] ?? (e.agent || "run")).padEnd(10)} ${(e.step ?? "").padEnd(22).slice(0, 22)}`;
  switch (e.type) {
    case "http":
      return `${at}  ${who}  ${String(e.service).padEnd(14)} ${e.method} ${String(e.url).replace(/^https?:\/\//, "").slice(0, 70)}  ${e.status ?? "ERR"}  ${secs(e.ms)}${e.credits != null ? `  ${e.credits} cr` : ""}`;
    case "llm":
      return `${at}  ${who}  ${"OpenAI".padEnd(14)} ${e.op} ${e.model}  ${e.tokensIn ?? 0}/${e.tokensOut ?? 0} tok  ${secs(e.ms)}${e.error ? `  ERROR ${e.error}` : ""}`;
    case "db":
      return e.read ? null : `${at}  ${who}  ${"Database".padEnd(14)} ${e.op} ${e.table}${e.rows != null ? `  ${e.rows} rows` : ""}${e.error ? `  ERROR ${e.error}` : ""}`;
    case "step-end":
      return `${at}  ${who}  ${e.status === "done" ? "✓" : "✗"} ${e.summary ?? e.error ?? ""}`;
    case "agent-end":
      return `${at}  ${who}  ${e.status === "done" ? "AGENT DONE" : "AGENT FAILED"}: ${e.summary ?? e.error ?? ""}`;
    case "run-start":
      return `${at}  RUN START  agents: ${(e.agents ?? []).join(", ")}`;
    case "run-end":
      return `${at}  RUN ${String(e.status).toUpperCase()}`;
    default:
      return null;
  }
}

function report(id: string, file: string, out?: string) {
  const events = readEvents(file);
  const template = readFileSync(VIEWER, "utf8");
  const data = JSON.stringify({ meta: { label: option("--label") ?? "Research run", note: option("--note") }, events }).replace(/</g, "\\u003c");
  const page = template.replace("__TRACE_DATA__", () => data);
  const target = out ?? path.join(DIR, `${id}.html`);
  writeFileSync(target, out ? page : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${page}</body></html>`);

  const count = (type: string, test: (e: Event) => boolean = () => true) => events.filter((e) => e.type === type && test(e)).length;
  const t0 = Math.min(...events.map((e) => e.ts));
  const t1 = Math.max(...events.map((e) => e.ts + (e.ms ?? 0)));
  const cost = events.filter((e) => e.type === "step-end").reduce((n, e) => n + (e.costUsd ?? 0), 0);
  console.log(`Run ${id}`);
  console.log(`  ${events.length} events over ${secs(t1 - t0)} · ${count("http")} vendor calls (${count("http", (e) => !!e.error || e.status >= 400)} failed) · ${count("llm")} AI calls · ${count("db", (e) => !e.read)} database writes · ~$${cost.toFixed(2)}`);
  for (const e of events.filter((x) => x.type === "agent-end")) console.log(`  ${e.status === "done" ? "✓" : "✗"} ${AGENT[e.agent] ?? e.agent}: ${e.summary ?? e.error}`);
  console.log(`\nReport: ${pathToFileURL(target).href}`);
}

function follow() {
  let current = runs()[0];
  let offset = current?.size ?? 0;
  let t0 = 0;
  console.log(current ? `Following ${current.id} (new runs are picked up automatically). Ctrl+C to stop.` : "Waiting for a run…");
  setInterval(() => {
    const latest = runs()[0];
    if (!latest) return;
    if (!current || latest.id !== current.id) {
      current = latest;
      offset = 0;
      t0 = 0;
      console.log(`\n— ${latest.id} —`);
    }
    const size = statSync(current.file).size;
    if (size <= offset) return;
    const chunk = readFileSync(current.file, "utf8").slice(offset);
    offset = size;
    for (const text of chunk.split(/\r?\n/).filter(Boolean)) {
      try {
        const e = JSON.parse(text) as Event;
        t0 ||= e.ts;
        const out = line(e, t0);
        if (out) console.log(out);
      } catch {
        // partial line; skipped
      }
    }
  }, 500);
}

const all = runs();
if (flag("--follow")) follow();
else if (flag("--list")) {
  if (!all.length) console.log("No runs recorded yet. Set TRACE_LOG=1 in .env.local, restart npm run dev, and run the research.");
  for (const r of all) console.log(`${new Date(r.mtime).toLocaleString()}  ${r.id}  (${(r.size / 1024).toFixed(0)} KB)`);
} else {
  const wanted = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
  const pick = wanted ? all.find((r) => r.id === wanted) : all.find((r) => r.id !== "_other");
  if (!pick) {
    console.log(all.length ? `No run "${wanted}". Try npm run trace -- --list` : "No runs recorded yet. Set TRACE_LOG=1 in .env.local, restart npm run dev, and run the research.");
    process.exit(1);
  }
  report(pick.id, pick.file, option("--out"));
}
