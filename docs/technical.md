# Technical Details

Spec: **Prodo Agent Blueprint** (https://claude.ai/artifact/FdBQTmEf44xghnbi2hua4a). Items marked *(planned, phase X)* are in the Sprint 1 Plan but not built yet.

## Principle: code, AI, vendor

Our own code handles anything rule-based (maths, layout, rendering, scheduling, validation). The AI model handles judgement. A paid vendor is used only where our code can't do the job. All text on ads (headline, CTA, price badge, logo) is drawn by our code with Satori, never by the image model.

## Services

| Service | Used for | Used by |
|---|---|---|
| OpenAI | Text, vision, embeddings (`text-embedding-3-small`, 1536 dims) | All agents |
| Kie | nano-banana images, Seedance video clips | Producer, manual create |
| ElevenLabs | Voice-over with word timestamps, music | Producer, manual create |
| Zernio | Publishing, scheduling, connected accounts, per-post analytics. Replaces Upload-Post | Social & Market Analyst, Publisher, Performance Analyst |
| Upload-Post | Legacy publisher, kept registered so posts made before Zernio still resolve | Publish jobs |
| Twelve Labs (Pegasus 1.5) | Video understanding: hook, structure, pacing. Pegasus 1.2 was retired; 1.5 needs no index | Social & Market Analyst, QA Critic, Performance Analyst |
| Firecrawl | Website map, crawl, screenshots | Website Analyst, Visual Identity Analyst |
| ScrapeCreators | Public profiles and posts (Instagram, TikTok, YouTube), Meta and Google ad libraries, Google search. Replaces SerpAPI (see below) | Social & Market Analyst |
| FFmpeg worker (`worker/`) | Self-hosted on a **Hostinger** VPS. Stitching today; captions, music, end cards and renditions in Sprint 2 | Producer, QA Critic |
| Supabase | Postgres, storage, auth, pgvector | All |
| Inngest | Jobs, weekly cron, approval waits, retries | All |

## Provider Adapter Pattern

External services are isolated behind interfaces in `src/providers/`. Nothing outside that folder imports a vendor SDK or calls a vendor URL.

### AI (`providers/ai/`)

`registry.ts` exports one `ai` object. Jobs, routes and agents call it, never a vendor file:

| Call | Provider | Returns |
|---|---|---|
| `ai.text(prompt, system?)`, `ai.vision(prompt, imageUrl, system?)` | OpenAI | `{ data: string, usage }` |
| `ai.structured(zodSchema, prompt, { system?, images?, model? })` | OpenAI JSON mode | `{ data: T, usage }`; a bad shape is a retryable error. `images` are public URLs |
| `ai.embed(texts)` | OpenAI `text-embedding-3-small` | `{ data: number[][], usage }` |
| `ai.image.create / status`, `ai.video.create / status`, `ai.task.error / resultUrl` | Kie | task id, then status |
| `ai.voice`, `ai.voices`, `ai.music` | ElevenLabs | audio + word timings |
| `ai.analyzeVideo(videoUrl, prompt, jsonSchema?)` | Twelve Labs Pegasus 1.5 | JSON answer in one call (no index, no polling; videos up to 1 hour) |
| `ai.crawl.map / scrape / screenshot / start / status` | Firecrawl | pages as markdown; `scrape(url, { design: true })` adds raw HTML and a screenshot |
| `ai.search.google(query, region?)` | ScrapeCreators | web results |
| `ai.ads.google(domain)`, `ai.ads.metaAdvertisers(name)`, `ai.ads.meta(pageId, country?)` | ScrapeCreators | ad creatives |
| `ai.social.profile(platform, handle)`, `ai.social.posts(platform, handle, limit)` | ScrapeCreators | normalised `SocialProfile` / `SocialPost` (Instagram, TikTok, YouTube) |

**SerpAPI was replaced by ScrapeCreators** (decision, Phase 1.8): one key covers search, ads and public social data. Google Trends and Maps reviews are dropped for now; dates come from the client's answers and reviews from the website and the client.

`usage` is `{ provider, model, tokensIn, tokensOut, costUsd }`. Model names live in `src/config/models.ts`; estimated prices in `src/config/pricing.ts` (update them from each vendor's pricing page).

`providers/http.ts` gives every adapter the same plumbing: `request()` adds a timeout (60 s, 5 min for downloads), and `statusError()` / `jsonOrThrow()` turn an HTTP status into a plain `AppError`.

### Publishing (`providers/publishing/`)

`Publisher` interface: `publishPhoto`, `publishVideo`, `publishText`, `publishCarousel` (optional), `getStatus(ref, platform)`, `cancelScheduled`, `listAccounts`, `getConnectUrl(platform)`. `registry.ts` maps provider names to implementations; `publisherFor()` with no argument returns the default, **Zernio**. Each `post_targets` row stores its provider, so old Upload-Post rows keep working.

Zernio (`https://zernio.com/api/v1`, Bearer key): one Zernio post per target (`POST /posts` with `publishNow` or `scheduledFor` in UTC), status from `GET /posts/{id}` per platform, cancel with `DELETE /posts/{id}`, accounts from `GET /accounts?profileId=`, connect links from `GET /connect/{platform}?profileId=`. When a target is published, `check-post-status` saves `provider_post_id` and `published_at`. Each client has its own Zernio profile: the first accounts or connect call creates one named after the business, tagged `externalId = prodo-<supabase ref>` (a repeat create returns 409 and the existing id), and saves its id in `app_settings.zernio_profile_id`. The account's default profile is never used.

### Analytics (`providers/analytics/`)

`Analytics` interface, implemented by `zernio.ts`: `getPostMetrics(providerPostId)` (null while Zernio is still syncing), `getMetricsSince(date, page)`, `getAccountStats(accountId)`, `listPastPosts(accountId, limit)` (with media URLs when available). `analyticsFor()` returns it.

### FFmpeg worker (`worker/`, `providers/ffmpeg/`)

A small Node 24 service with no npm dependencies, deployed with Docker + Caddy (HTTPS) on a Hostinger VPS. See `worker/README.md`.

- `POST /jobs { inputs, args, outputKey }` (header `x-worker-secret`) returns a job id at once; `GET /jobs/:id` gives `queued | running | done | failed`.
- Inputs are storage keys or `https` URLs on our Supabase host or `ALLOWED_INPUT_HOSTS` (Kie result hosts). Anything else is rejected.
- ffmpeg runs with an argument list, never a shell string. Two jobs at a time, 10 minutes each. The result is uploaded straight to storage at `outputKey`, and temp files are deleted.
- `generate-video` submits the stitch with `submitSceneStitchJob()` and polls with `step.sleep`. Per-scene voice files are saved at `audio/<mediaId>/voice-<n>.mp3` and tracked as `media_files` rows (`role = voice`). Deleting media removes all its files from storage.

### Storage (`providers/storage/`)

`supabase-storage.ts` is the only file that turns a storage key into a URL. Everything else stores and passes keys.

## Agents

Ten agents, each an Inngest function with one step per outside call.

| # | Agent | Runs | Writes |
|---|---|---|---|
| 1 | Website Analyst | Onboarding submit, Refresh brand | `brand_sources`, `brand_chunks`, `offerings`, `proof_items`, `offers` |
| 2 | Visual Identity Analyst | Onboarding submit, logo change | `brand_kit` |
| 3 | Social & Market Analyst | Onboarding, monthly refresh | `brand_sources`, `competitors.analysis`, `proof_items`, `calendar_events`, `learnings` (baseline), `hook_library` |
| 4 | Brand Strategist | After 1–3; on Regenerate | `brand_bible` (draft), `personas`, `content_pillars`, `hook_library` |
| 5 | Planner | Weekly cron, "Plan next week" | `content_plans`, `plan_items` |
| 6 | Creative Director | Each new slot | `plan_items.brief`, `captions`, `hook_library` |
| 7 | Producer | Brief passes QA Gate 1 | `media`, `media_files` |
| 8 | QA Critic | Gate 1 after each brief, Gate 2 after each asset | `brief_score`, `qa_score`, `qa_report`, `selected_media_id` |
| 9 | Publisher | Plan or post approved, or timeout in full-auto | `posts`, `post_targets`, `notifications` |
| 10 | Performance Analyst | Daily metrics, weekly learnings | `post_metrics`, `account_snapshots`, `learnings`, `notifications` |

Sprint 1 builds agents 1–4 (Phases 1.8–1.9). The rest are Sprint 2.

### Onboarding flow

```
wizard (1.7, built) → submit → onboarding/started → [1 Website ‖ 2 Visual ‖ 3 Social & Market] → 4 Brand Strategist   (1.8–1.9)
→ Brand Bible draft → client review (edit / regenerate / approve) → brand/approved → Planner (Sprint 2)
```

`business_profile.onboarding_status`: `not_started → collecting → analyzing → review → done`. The first saved step sets `collecting`; submit sets `analyzing`.

**Routing.** After login, `(app)/layout.tsx` sends anyone not `done` to `/onboarding`; `onboarding/layout.tsx` sends `done` users to `/dashboard`. `/onboarding` resumes at the furthest saved step (`business_profile.onboarding.step`), or `/onboarding/progress` after submit. Steps beyond the furthest one redirect back. Both layouts read the session through `getSession()`, cached per request.

**Data flow.** `onboarding/layout.tsx` loads the full draft once on the server (`loadOnboarding`, one round of parallel queries) into a Zustand store. Moving between steps makes no requests. Continue runs `useStepSave`: drop empty list rows → validate with the step's zod schema (field errors under keys like `products.0.name`) → `PUT /api/onboarding/{step}` → merge the server's copy of that slice back. Unsaved edits on other steps stay in the store.

**Where answers go**

| Step | Saved to |
|---|---|
| Basics | `business_profile` (name, logo_key, description, website, social_urls, business_type, countries, language, timezone, primary_goal), cities in `onboarding.cities` |
| Products | `offerings` (kind product), `brand_assets` (product_photo), `offers`, `proof_items` (review, link kept as a `brand_sources` row with the same id), `calendar_events` (source client) |
| Services | `offerings` (kind service, details in `attributes`, FAQs as `objections`), `proof_items` (case_study, certification, award), `brand_assets` (team, location, work; case study photos tagged `case:<id>`), `cta_links`, area/years/FAQs in `onboarding` |
| Style | `business_profile` (tone, liked_brands, compliance, posting_prefs, voice_id, music_mood), `competitors`, `brand_assets` (reference_video), `app_settings` (autopilot, plan day and time, budget) |
| Connect | Accounts are read live from Zernio. Only the client's profile id is stored (`app_settings.zernio_profile_id`) |

Removed list items: offerings and offers are archived (`active = false`); reviews, case studies, credentials, dates, competitors and assets are deleted (asset files too).

**APIs.** `PUT /api/onboarding/[step]`, `POST /api/onboarding/submit` (sends `onboarding/started`, event id = run id), `POST /api/uploads` (signed upload link), `POST /api/onboarding/import/shopify` (reads a store's public `products.json`; CSV import is parsed in the browser).

**Submit.** Sets `onboarding_status = analyzing`, writes `onboarding.research` (all agents queued) and sends `onboarding/started` (event id = attempt id, so a double submit runs once). The client moves to `/onboarding/progress`.

### Brand research (Phase 1.8)

`onboarding-run` (`src/jobs/onboarding-run.ts`) runs the agents in parallel with `step.invoke`. Each agent is its own Inngest function made by `defineResearchAgent` (`src/agents/research/define.ts`): it marks itself running, loads the business context, runs, and records a one-line summary (or its error, in `onFailure`). One failed agent doesn't stop the others. When all three succeed, the Brand Strategist (agent 4) writes the Brand Bible draft; during onboarding the run then sets `onboarding_status = review` (after onboarding, "Refresh brand" leaves it `done`).

| Agent | Folder | Steps | Writes |
|---|---|---|---|
| 1 Website Analyst | `agents/website-analyst/` | map site → rank up to 30 pages by URL (code) → read each page (Firecrawl; unchanged pages skipped by hash) → embed changed pages → pull facts per page (AI, zod) → merge: near-identical names matched in code, then one AI check that drops repeats across pages and items the client already entered (it only drops, never rewrites) | `brand_sources` (web_page), `brand_chunks`, `offerings`, `offers`, `proof_items` (extracted rows inactive/unverified, with `source_id`) |
| 2 Visual Identity Analyst | `agents/visual-identity/` | homepage HTML, CSS and screenshot (Firecrawl) → logo palette and light/dark versions (sharp, node-vibrant) → brand colours and WCAG AA text pairs (code) → photo and layout style (AI vision) | `brand_kit`, logo variants in storage (`logo/variants/`) |
| 3 Social & Market Analyst | `agents/social-market/` | own posts (Zernio when connected, otherwise public profiles) → baselines and top/bottom 20% (code) → competitors: find if fewer than 2 (Google search + AI), Meta and Google ads, Instagram, homepage → summary (AI) → videos (Twelve Labs: up to 6 own, 4 competitor) → hooks (AI) | `brand_sources` (social_post, competitor), `brand_chunks`, `learnings` (baseline, format), `competitors` (+ discovered), `hook_library` |

Rules every agent follows:
- One `task(id, work, summary)` per outside call (a few make two dependent calls, e.g. find a Meta page, then read its ads). Every task is logged to `agent_runs` with `run_id` = the research id, its cost and a plain summary.
- Work the agent can do without (one page, one competitor, one video) is wrapped in `optional()`: after Inngest's retries it's skipped and shows as "Skipped a step" in the activity list.
- Hard caps: 30 pages, 5 competitors, 6 own videos, 4 competitor videos, 50 posts per platform.
- Prompts and their zod schemas live in `src/prompts/agents/`. Pure logic (ranking, chunking, colours, baselines) has its own files and is checked offline by `npm run smoke scripts/check/research-logic.ts`.
- Facts only: extracted offerings, offers and proof keep `source_id` and wait for the client (`active = false`, `verified = false`). Competitor findings stay on `competitors.analysis` and `competitor` sources, never in our facts or Brand Brain chunks.

**State.** `business_profile.onboarding.research` = `{ id, attempt, state: running|failed|done, startedAt, finishedAt, error, agents: { <agent>: { state: queued|running|done|failed, summary, error } } }`. Agents write it in parallel through `set_research_state(path, value)`, one atomic update each.

**Progress screen** (`/onboarding/progress`). `GET /api/onboarding/progress` returns the state, the last 40 logged steps, steps done per agent, cost so far and `stale` (running but nothing logged for 20 min). The page polls every 3 s while running and stops when done or failed. Closing, reloading or coming back later shows the same state from the server.

**Retry.** `POST /api/onboarding/retry` (allowed when failed or stale) keeps the research id, makes a new attempt id and runs only the agents that aren't done. Unchanged pages aren't paid for twice.

### Brand Strategist and Brand Bible (Phase 1.9)

Agent 4 (`agents/brand-strategist/`) runs after agents 1–3, and again on "Regenerate with a note" (`brand/regenerate` → `regenerate-bible` invokes it with the note).

load facts (answers, offerings incl. pending, proof, kit, market notes) → search the Brand Brain once per section (`match_brand_chunks`) → write core sections (AI) → personas and pillars (AI) → code checks → save draft → seed 10–15 hooks (AI, `hook_library` source `generated`).

- **Sources.** The model sees numbered sources: `[A]` the client's answers, `[O]` offerings, `[R]` proof, `[K]` brand kit, `[C]` Brand Brain passages, `[M]` market notes (competitor gaps, baselines; context only, never citable). `sources.ts` maps cited labels back to refs (`answer:<key>`, `offering:<id>`, `proof:<id>`, `kit`, `chunk:<id>`). Edits by the client add `client`.
- **Checks** (`checks.ts`, code): a claim with no real source is dropped; never-say words (the client's avoid list + the model's) can't appear anywhere; 3–4 personas and 4–5 pillars, otherwise a retryable error; pillar shares rescaled to add up to exactly 1; offer stack only uses known offerings and marks website finds as pending.
- **Versions.** Every draft (generated or edited) is a new `brand_bible` version; older drafts become `superseded`, so there's one draft at a time. Approving: the previous approved version is superseded, the draft's personas and pillars replace the active rows (old ones archived), `onboarding_status = done`, and `brand/approved` is sent (Sprint 2 listens).
- **Facts to confirm.** Offerings, offers and proof the Website Analyst found (`verified = false`) are listed for Confirm / Reject (`core/brand/pending.ts`). Rejecting an offering also removes it from the draft's offer stack.

**Review screen.** `/onboarding/bible` during onboarding (shown after research; `analyzing` only allows `/onboarding/progress`, `review` allows progress and bible), and Brand → Brand Bible afterwards. Same component (`modules/brand/components/bible/BibleReview`): read every section, "Show sources" on each statement, confirm found facts, edit (saves a new version), regenerate with a note, approve. Approving during onboarding opens the dashboard.

### Brand Hub and Settings (Phase 1.10)

**Brand** (`/brand?tab=…`, `modules/brand/`): Brand Bible (with version history), Offerings, Offers, Proof, Photos and videos, Personas, Pillars, Competitors (with the research's analysis; "Found by Prodo" for discovered ones), Brand kit. Every list is defined once in `core/brand/resources.ts` (fields, archive or delete, verify); the API (`/api/brand/resources/[resource]`) and the forms are built from it. Brand rows are archived, never deleted, and can be restored. Editing a row an agent found counts as confirming it.

**Refresh brand** runs a new research (new research id, all four agents); its progress shows on the Brand page, and the approved Bible stays in use until the new draft is approved.

**Settings**: Business profile (name, website, logo, description, language, timezone, main goal), Automation (`app_settings`: pause, autopilot mode, plan day and time, auto-approve timeout, monthly budget with this month's spend, notification email), Connected accounts. Products moved to Brand → Offerings; `/api/offerings` is now read-only (Create Content's picker).

### Agent logging and budget

```ts
const pages = await agentStep(step, "crawl-site", {
  agent: "website_analyst",
  summary: (pages) => `Read ${pages.length} pages`,
}, async (track) => {
  const r = await ai.crawl.map(url);
  track(r.usage);
  return r.data;
});
```

`agentStep` (`src/agents/run.ts`) runs the body inside `step.run`, writes one `agent_runs` row (`running`, then `done` or `failed`) with the summary, tokens, `cost_usd` and duration, and passes errors through `toInngestError`. A failed step still records what it spent.

Before the body runs, `assertBudget` (`src/agents/budget.ts`) stops it with `PAUSED` when `app_settings.paused` is on, or `BUDGET_REACHED` when this month's `agent_runs.cost_usd` total reaches `monthly_budget_usd`.

### Guardrails

- **Budget cap** and **pause switch** (`app_settings`)
- **Approval modes**: `full`, `approve_plan`, `approve_each`. Nothing posts unapproved outside full auto
- **Facts only**: claims, reviews, prices and deadlines come from stored facts; QA blocks anything else and checks the never-say list
- **Limited retries**: each step regenerates at most twice, then "Needs review" with the reason
- **Plain errors**: vendor errors become a plain message on the row

## Auth and access

- `src/middleware.ts` runs on every page and `/api` route. Logged-out page requests redirect to `/login?next=…`; logged-out API requests get `401 { error: { code: "UNAUTHORIZED", message } }`. Public: `/login`, `/api/auth/callback`, `/api/inngest` (Inngest signs its own requests).
- `apiHandler()` checks the session again as a second layer. Pass `{ public: true }` only for routes that must work logged out.
- Database: RLS on every table, `authenticated` role only, no `anon` privileges (migration `0009`). Jobs and agents use `createAdminClient()` (service role).
- Storage bucket `media`: public read, writes for logged-in users only.
- Signups are off in Supabase Auth; users are created in the dashboard.

## Error Handling Chain

```
Vendor error → adapter translates to AppError(type, message, retryable)
→ job: toInngestError converts to NonRetriableError or RetryAfterError
→ Inngest retries the step or stops the run
→ onFailure writes status + message to the DB row
→ screen reads the row and shows the message
```

Error types: `PROVIDER_DOWN` (retryable), `RATE_LIMITED` (retryable with delay), `OUT_OF_CREDIT` (permanent), `CONTENT_BLOCKED` (permanent), `ACCOUNT_DISCONNECTED` (permanent), `INVALID_INPUT` (permanent), `NOT_CONFIGURED` (permanent: missing or wrong key), `BUDGET_REACHED` (permanent), `PAUSED` (permanent), `TIMEOUT` (retryable), `UNKNOWN` (retryable).

Inside jobs, wrap step bodies so errors pass through `toInngestError`, e.g. `step.run("x", () => fn().catch(toInngestError))`.

## Trace logs (development)

Set `TRACE_LOG=1` in `.env.local` and restart `npm run dev`. Every research run then writes `.logs/research/<research id>.jsonl` (gitignored; off in production):

- **Vendor calls**: everything through `providers/http.ts` `request()` (Firecrawl, ScrapeCreators, Twelve Labs, Zernio, Kie, ElevenLabs, website CSS): method, URL, request body, status, response, time, ScrapeCreators credits.
- **AI calls**: the OpenAI adapter's chat (full prompt and reply) and embeddings (count only), tokens and estimated cost.
- **Database**: every call of the service-role client (`createAdminClient` gets a tracing `fetch`): table, operation, filter, data sent, rows, result. Reads are marked so reports can hide them.
- **Structure**: run, agent and step start/end with summaries, costs and step results; row counts and the brand kit at the start and end of a run.

Events carry their run, agent, step and attempt through `AsyncLocalStorage` (`src/lib/trace/`). Secrets from environment variables are stripped, long values cut, vectors replaced by a note. Tracing never throws.

`npm run trace` builds an HTML report for the latest run (`.logs/research/<run>.html`); `-- <run id>`, `-- --list`, `-- --follow` (live lines in the terminal), `-- --out <file>` (page without wrapper, for an artifact). The viewer is `scripts/trace/viewer.html`; it can also load a `.jsonl` file directly.

## Smoke tests

`npm run smoke scripts/smoke/<name>.ts` makes one small real call and prints the result and its estimated cost: `openai`, `kie`, `elevenlabs`, `firecrawl [url]`, `scrapecreators [instagramHandle]` (one Google search; with a handle, also that profile and its posts), `twelvelabs [videoUrl]` (defaults to a 5 s sample), `zernio` (read-only), `ffmpeg-worker`, `agent-step` (writes one `agent_runs` row and checks a $0 budget blocks agents). Never fake a vendor response to make one pass.

Raw vendor error messages never reach the browser. Every `AppError` has a plain, user-facing message.

## Inngest Job Rules

1. Each outside call is its own step — retries only replay the failed step
2. Vendor retries disabled (`maxRetries: 0`) — Inngest is the only retry layer
3. Every fetch has a timeout (60s default, 5min for downloads)
4. Event ID = media/post ID — Inngest deduplicates double-clicks
5. `cancelOn` stops a run when the item is deleted mid-job
6. Concurrency: 5 images, 2 videos, 1 run per post
7. `onFailure` writes status + message to the DB row
8. `step.sleep` for polling — no server runs while waiting
9. Large files go to storage first; steps pass only the key (Inngest caps step output size)

## Kie Gotcha

Kie returns HTTP 200 even on failure. Must read the `code` field in the response body. Task states: `success`, `fail` (with `failMsg`/`failCode`). Always check the body, not just `response.ok`.

## Module Structure

```
src/app/(app)/<tab>/page.tsx      → thin, renders the module page
src/modules/<module>/pages/       → actual page components
src/modules/<module>/components/  → tab-specific components
src/modules/<module>/hooks/       → data fetching hooks
src/core/                         → our rules, no vendor names (profile, offerings, media, posts, captions, errors)
src/jobs/                         → Inngest functions
src/agents/                       → agentStep and optional() (run.ts), budget guard (budget.ts)
src/agents/research/              → shared by research agents: context, Brand Brain (brain.ts), defineResearchAgent
src/agents/<agent-name>/          → one folder per agent: index.ts runs the steps, other files do one job each
src/prompts/agents/               → agent prompts with their zod schemas
src/core/brand/                   → Brand Bible versions, pending facts, sources, Brand Hub lists, brand kit
src/prompts/                      → craft rules only, no business facts
src/providers/                    → the only place a vendor is named
```

Nav entries in `src/config/navigation.ts`. Routes in `src/config/routes.ts`.

## API Routes

Every route wraps its handler with `apiHandler()` from `src/lib/api-handler.ts`, which checks the session and turns errors into `{ error: { code, message } }`. Browser-side `apiFetch()` from `src/lib/api-client.ts` reads that format and throws `ApiError`.

| Route | Methods | What |
|---|---|---|
| `/api/profile` | GET, PUT | Business profile; PUT is multipart (fields + logo) |
| `/api/offerings` | GET | Active offerings (Create Content's picker) |
| `/api/onboarding/[step]`, `/submit`, `/progress`, `/retry`, `/import/shopify` | | Wizard saves, submit, research progress and retry |
| `/api/brand/bible` | GET, PUT | Approved + draft + history + Strategist state; PUT saves edits as a new draft |
| `/api/brand/bible/[id]`, `…/approve`, `/api/brand/bible/regenerate` | GET, POST | One version; approve a draft; new draft with a note |
| `/api/brand/sources?refs=` | GET | The text behind a claim |
| `/api/brand/pending` | GET, POST | Facts found on the website; confirm or reject |
| `/api/brand/resources/[resource]`, `…/[id]` | GET, POST, PATCH, DELETE | Brand Hub lists (archive or delete; PATCH `{active:true}` restores) |
| `/api/brand/kit` | GET, PUT | Brand kit; saving recomputes readable colour pairs |
| `/api/brand/refresh` | POST | Start "Refresh brand" |
| `/api/settings/automation` | GET, PUT | `app_settings` + this month's spend |
| `/api/media`, `/api/media/[id]`, `…/retry`, `…/captions`, `/api/media/reference`, `/api/media/improve-idea` | | Media library and generation |
| `/api/posts`, `/api/posts/[id]`, `…/publish`, `…/cancel` | | Posts and publishing |
| `/api/accounts`, `/api/accounts/connect?platform=` | GET | Live accounts; connect link for a platform |
| `/api/dashboard`, `/api/captions/improve`, `/api/elevenlabs/voices` | | Analytics, helpers |

## Key Design Decisions

- **Storage keys over URLs** — only `supabase-storage.ts` builds full URLs.
- **Connected accounts fetched live** — no `connected_accounts` table.
- **Captions at post time** — the same media can be reposted, and captions differ by platform.
- **All inputs saved** — `media` stores every generation input, plus `creative_spec`, so "Try again" reruns the same thing.
- **Products and services are offerings** — one table with `kind`, archived instead of deleted. Media points at an offering by id; a free-text "Other" product is kept in `creative_spec.product_name`.
- **Settings apart from brand facts** — `app_settings` holds autopilot, budget and pause, so agents only see brand facts.
- **Single profile API** — `PUT /api/profile` is multipart, fields + logo in one request.
