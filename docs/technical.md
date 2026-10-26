# Technical Details

Spec: **Prodo Agent Blueprint** (https://claude.ai/artifact/FdBQTmEf44xghnbi2hua4a). All ten agents are built (Sprint 1: 1–4; Sprint 2: 5–10).

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
| FFmpeg worker (`worker/`) | Self-hosted on a **Hostinger** VPS. Scene clips, burned-in captions, music under the voice, end card, 9:16 and 4:5, loudness | Producer, manual create |
| Resend | Email for notifications. Off until `EMAIL_ENABLED=1` (emails are only logged) | Notifications |
| Google Fonts | Brand fonts as files for our renderers (Satori and captions), kept in storage | Producer |
| Nager.Date | Public holidays per country (free, no key) | Monthly refresh |
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

`Publisher` interface: `publishPhoto`, `publishVideo`, `publishText`, `publishCarousel` (optional), `getStatus(ref, platform)`, `cancelScheduled`, `listAccounts(db)`, `getConnectUrl(db, platform)` (`db` is the business's database: RLS client or `businessDb`). `registry.ts` maps provider names to implementations; `publisherFor()` with no argument returns the default, **Zernio**. Each `post_targets` row stores its provider, so old Upload-Post rows keep working.

Zernio (`https://zernio.com/api/v1`, Bearer key): one Zernio post per target (`POST /posts` with `publishNow` or `scheduledFor` in UTC), status from `GET /posts/{id}` per platform, cancel with `DELETE /posts/{id}`, accounts from `GET /accounts?profileId=`, connect links from `GET /connect/{platform}?profileId=`. When a target is published, `check-post-status` saves `provider_post_id` and `published_at`. Each business has its own Zernio profile (one Zernio API key for all): the first accounts or connect call creates one named after the business, tagged `externalId = prodo-<supabase ref>-<business id>` (a repeat create returns 409 and the existing id), and saves its id in that business's `app_settings.zernio_profile_id`. The profile id is read from the database on every call, never cached in memory. The account's default profile is never used. Accounts the browser picks for a post are checked against the business's own list (`ownTargets()` in `core/posts.ts`), and their name and provider come from Zernio. Upload-Post publishing has one profile for the whole deploy, so it stays legacy-only.

### Analytics (`providers/analytics/`)

`Analytics` interface, implemented by `zernio.ts`: `getPostMetrics(providerPostId)` (null while Zernio is still syncing), `getMetricsSince(date, page)`, `getAccountStats(accountId)`, `listPastPosts(accountId, limit)` (with media URLs when available). `analyticsFor()` returns it.

### Video rendering (`providers/ffmpeg/`)

Two backends behind one client (`client.ts`: `submitJob`, `getJob`, `videoReady`). New jobs go to **our worker** when `FFMPEG_WORKER_URL` and `FFMPEG_WORKER_SECRET` are set, otherwise to **Upload-Post's FFmpeg API** (`UPLOAD_POST_API_KEY`); `RENDERER` forces one. Job ids carry their backend and output key, so a job always finishes where it started. Connecting the worker later needs no code change.

Upload-Post (`backends/upload-post.ts`), rules found with real jobs: files go in as public URLs and the command uses `{input}` (first file), `{input1}`… and `{output}`; `; | & $` and backticks aren't allowed, so the filter graph is uploaded as a file (`-filter_complex_script`); placeholders aren't filled in inside that file, so captions are burned in by a second job (`-vf subtitles={input1}`) with Upload-Post's own font (the worker uses the brand font). The finished file is downloaded into our storage; working files live under `render-jobs/<id>/` and are removed afterwards. It uses Upload-Post's monthly processing minutes. Check it with `npm run smoke scripts/smoke/upload-post-render.ts`.

### FFmpeg worker (`worker/`)

A small Node 24 service with no npm dependencies, deployed with Docker + Caddy (HTTPS) on a Hostinger VPS. See `worker/README.md`.

- `POST /jobs { inputs, args, outputKey }` (header `x-worker-secret`) returns a job id at once; `GET /jobs/:id` gives `queued | running | done | failed`.
- Inputs are storage keys or `https` URLs on our Supabase host or `ALLOWED_INPUT_HOSTS` (Kie result hosts). Anything else is rejected.
- ffmpeg runs with an argument list, never a shell string. Two jobs at a time, 10 minutes each. The result is uploaded straight to storage at `outputKey`, and temp files are deleted.
- `compose-video.ts` builds the whole video in one run (clips, captions, end card, voice, music, loudness); the Producer and manual `generate-video` submit it and poll with `step.sleep`. `{dir}` in an argument is the job's folder, so captions find the brand font downloaded as an input. Per-scene voice files are saved at `audio/<mediaId>/voice-<n>.mp3` and tracked as `media_files` rows (`role = voice`). Deleting media removes all its files from storage.

### Storage (`providers/storage/`)

`supabase-storage.ts` is the only file that turns a storage key into a URL. Everything else stores and passes keys.

A business's files live under `<business id>/…`: `businessKey(businessId, path)` and `storageKeyFor(businessId, type, id)` build keys; the Producer's `dated(businessId, …)` too. Logged-in users can only create files in their own folder (signed upload links from `POST /api/uploads`) and can't list the bucket; replacing and deleting is done by the server (`removeFiles(businessId, keys)` in `remove-files.ts`), which only deletes keys in that business's folder (or old unfoldered files, for the business that owns them). A key sent by the browser must be in the business's folder or already one of its files (`assertOwnKey()`). Files made before multi-tenant keep their old paths. Shared files with no business: `fonts/` (Google Fonts cache) and `render-jobs/` (Upload-Post working files).

## Multi-tenant

One deploy serves every business. One login owns one business (`businesses.owner_id`, migration 0017), and every table has `business_id`.

- **New logins**: Supabase → Authentication → Add user. A trigger on `auth.users` creates the business; a trigger on `businesses` creates its `business_profile`, `app_settings` (notification email = the login's email) and `brand_kit` rows. The person then goes through onboarding.
- **API routes** use the logged-in client. RLS (`own_business`: `business_id = current_business_id()`) limits every query, and inserts get `business_id` from the column default. `currentBusiness()` (`src/core/business.ts`) gives the id when a route needs it (events, storage keys). A login with no business is signed out with a message.
- **Agents and jobs** use `businessDb(businessId)` (`src/lib/supabase/business.ts`): the service role, but every select, update and delete is filtered to the business, every insert and upsert is stamped with it, an update can't change it, and every `rpc()` gets `p_business_id`. It refuses the `businesses` table. `createAdminClient()` is only for storage and for `listActiveBusinessIds()`.
- **Events**: every event has `businessId` (`ForBusiness<…>` in `src/jobs/client.ts`, so a missing one doesn't compile). Event ids built from a week or a time include it (`plan-<business>-<week>`, `learn-<business>-…`).
- **Crons** (`cronForEveryBusiness` in `src/jobs/every-business.ts`) list the businesses that finished onboarding and still have an owner, and send one event each: `plan/check-due` (hourly), `performance/sync` (daily), `performance/learn` (Sundays), `brand/monthly-refresh` (1st of the month). The function behind each event does the work for that business.
- **Concurrency** is per business where it limits work (one plan, one research, three slots at a time, one learning run), so one business never waits for another.
- **Settings rows** are one per business: read with `.single()`, update with `ownRow(...)` (the API refuses an update without a filter).
- **Database guards**: foreign keys include `business_id` (`(col, business_id) → parent (id, business_id)`), so a row can't point at another business's row; a trigger stops `business_id` from changing; unique rules (week, Bible version, learnings, snapshots, reports) are per business; `match_brand_chunks`, `match_recent_hooks` and `set_research_state` search or write one business.
- **Server-only columns**: logged-in users can write their own rows straight through the API, so a trigger (`guard_server_columns`) lets only the server set `app_settings.zernio_profile_id`, `post_targets.provider_ref` and `post_targets.provider_post_id` (users may only clear them). `publish-post` checks every target's account against the business's connected accounts again before posting. File deletes (`removeFiles(businessId, keys)`) only touch the business's folder, or old unfoldered files when `businesses.owns_unfoldered_files` is set (the first business).
- **Cancel events** match the business as well as the item (`cancelOn` with `if: … && event.data.businessId == async.data.businessId`).
- **Browser**: logging in or out reloads the page, so nothing cached from one business shows for the next login.
- **Known limit**: Zernio analytics (`getMetricsSince`) pages through the whole Zernio account, shared by every business. Only the business's own posts are saved, but with many businesses its posts can fall past the 20-page cap and fall back to single lookups.

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

Agents 1–4 run at onboarding and on "Refresh brand"; 5–9 run the weekly loop (see Weekly loop); 10 runs daily and weekly (see Learning loop).

### Onboarding flow

```
wizard (1.7, built) → submit → onboarding/started → [1 Website ‖ 2 Visual ‖ 3 Social & Market] → 4 Brand Strategist   (1.8–1.9)
→ Brand Bible draft → client review (edit / regenerate / approve) → brand/approved → first plan (Planner, next week)
```

`business_profile.onboarding_status`: `not_started → collecting → analyzing → review → done`. The first saved step sets `collecting`; submit sets `analyzing`.

**Routing.** After login, `(app)/layout.tsx` sends anyone not `done` to `/onboarding`; `onboarding/layout.tsx` sends `done` users to `/week` (home; the old Dashboard was removed). `/onboarding` resumes at the furthest saved step (`business_profile.onboarding.step`), or `/onboarding/progress` after submit. Steps beyond the furthest one redirect back. Both layouts read the session through `getSession()`, cached per request.

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
| 2 Visual Identity Analyst | `agents/visual-identity/` | homepage HTML, CSS and screenshot (Firecrawl) → logo palette and light/dark versions (sharp, node-vibrant) → brand colours and WCAG AA text pairs (code) → photo and layout style (AI vision) | `brand_kit`, logo variants in storage (`<business id>/logo/variants/`) |
| 3 Social & Market Analyst | `agents/social-market/` | social profiles the client left empty, taken from their homepage links (plain download, no AI; only empty fields are filled, saved to `business_profile.social_urls`) → own posts (Zernio when connected, otherwise public profiles) → baselines and top/bottom 20% (code) → competitors: find if fewer than 2 (Google search + AI), Meta and Google ads, Instagram, homepage → summary (AI) → videos (Twelve Labs: up to 6 own, 4 competitor) → hooks (AI) | `brand_sources` (social_post, competitor), `brand_chunks`, `learnings` (baseline, format), `competitors` (+ discovered), `hook_library` |

Rules every agent follows:
- One `task(id, work, summary)` per outside call (a few make two dependent calls, e.g. find a Meta page, then read its ads). Every task is logged to `agent_runs` with `run_id` = the research id, its cost and a plain summary.
- Work the agent can do without (one page, one competitor, one video) is wrapped in `optional()`: after Inngest's retries it's skipped and shows as "Skipped a step" in the activity list.
- Hard caps: 30 pages, 5 competitors, 6 own videos, 4 competitor videos, 50 posts per platform.
- Prompts and their zod schemas live in `src/prompts/agents/`. Pure logic (ranking, chunking, colours, baselines) has its own files and is checked offline by `npm run smoke scripts/check/research-logic.ts`.
- Facts only: extracted offerings, offers and proof keep `source_id` and wait for the client (`active = false`, `verified = false`). Competitor findings stay on `competitors.analysis` and `competitor` sources, never in our facts or Brand Brain chunks.

**State.** `business_profile.onboarding.research` = `{ id, attempt, state: running|failed|done, startedAt, finishedAt, error, agents: { <agent>: { state: queued|running|done|failed, summary, error } } }`. Agents write it in parallel through `set_research_state(path, value, p_business_id)`, one atomic update each.

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

### Weekly loop (Sprint 2: agents 5–9)

```
weekly cron (hourly, one `plan/check-due` per business; fires on that business's plan day and hour, in its time zone) or "Plan this week" or the first Brand Bible approval
→ plan/requested → 5 Planner → plan-item/produce × N
→ per slot: 6 Creative Director → 8 QA Gate 1 (≤ 2 rewrites) → 7 Producer → 8 QA Gate 2 (≤ 2 targeted redos) → ready | needs_review
→ plan-item/settled → all settled: plan → review, notify (in-app + email) → client approves (or full autopilot after the timeout)
→ plan/approved | plan-item/approved → 9 Publisher → posts + post_targets → publish-post → check-post-status → slot published
```

Each slot is one run of `produce-plan-item` (`agents/weekly/produce-item.ts`, 3 at a time, cancelled by `plan-item/cancelled`). Every outside call is an `agentStep` logged against the plan (`run_id = plan_id`), the slot and its media, so `/week` shows live activity and the cost per post.

| Agent | Folder | What | Code does | AI does |
|---|---|---|---|---|
| 5 Planner | `agents/planner/` | Plans one week | Slot count from posts per week (Settings → Automation), days spread evenly, platforms per slot, local posting times (defaults until learnings have 10+ posts), format mix weighted by learnings and supported by every platform in the slot, pillar mix by largest remainder, 30% experiments, no back-to-back repeat of format, offering or angle on a platform, offers only while live | Offering, offer, persona, angle, objective, hook type, levers and the reason per slot; the week's theme |
| 6 Creative Director | `agents/creative-director/` | One slot → a brief (`core/creative/brief.ts`) | Numbered fact book (`[O1]` offering, `[F1]` offer, `[R…]` verified proof, `[C…]` Brand Brain passages, `[G…]` real photos); labels → stored refs; claims, badges and fact levers without a source dropped; word limits (headline 8, overlay 7, slide title 8, body 30, ~2.5 spoken words/s), caption length per platform, never-say words, no urgency without a live offer; one rewrite when a check fails; hook swapped when ≥ 0.9 similar to one used in 60 days (`match_recent_hooks`); hook saved to `hook_library` | 8 hooks (one per type), framework, levers, CTA, claims, captions per platform, and per format: headline/subhead/badge/photo prompt/layout, 5–8 slides, or 3–6 scenes with voice-over, overlay, visual and camera move |
| 8 QA Gate 1 | `agents/qa-critic/gate1.ts` | Before any money is spent | Weighted score; pass = overall ≥ 7, compliance ≥ 7 and no open code problems | Scores hook, one message, persona fit, CTA, proof, compliance (0–10) and lists fixes |
| 7 Producer | `agents/producer/` | Makes the asset | Sizes per platform (`canvases.ts`); our layouts draw every word (`src/creative/`); captions as an `.ass` file from voice word timings; end card; compose on the FFmpeg worker | Kie photo (real product photo as reference), Kie clips, ElevenLabs voice per scene and music |
| 8 QA Gate 2 | `agents/qa-critic/gate2.ts` | After the asset | Sizes, every text colour pair ≥ 4.5:1, safe zones, caption length, video length, loudness | OpenAI vision for images and carousels (product matches the reference, no stray AI text, on brand); Twelve Labs for video (hook visible in 3 s, scenes match the script, no glitches) |
| 9 Publisher | `agents/publisher/` | Approved slot → scheduled post | One target per connected account on the slot's platforms, caption per platform (+ CTA link where links work), at the slot time (or 10 min from now), `origin = agent`; each platform gets its best size from the renditions (`publish-post`) | — |

**Days and video.** Planning the current week only uses days from tomorrow (a part week gets its share of the posts; on the last day the client is sent to next week). While the video renderer isn't connected (`videoReady()`: settings present and `/health` answers), the Planner plans no video slots and leaves video-only platforms out; every video path (`produce-plan-item`, manual `generate-video`, `/api/ads`, `/api/media` create, retry, redo) checks it first, so nothing is spent on a video that can't be put together.

**Redos.** Gate 1 below the bar sends the fixes back to the Creative Director (at most 2 rewrites, then `needs_review` with nothing spent). Gate 2 makes again only what failed: a new photo with QA's fix for images and carousels (all text is ours), only the flagged scenes for video (voice, other clips and music are kept), at most twice, then `needs_review` with the reason in `qa_report.reason`.

**Statuses.** Slot: `planned → briefed → producing → ready | needs_review → approved → scheduled → published` (or `rejected`, `failed`). Plan: `planning → producing → review → approved → scheduled` (or `failed`).

**Approval modes** (`app_settings.autopilot_mode`). `approve_plan`: the client approves the plan (all `ready` slots) or single slots. `approve_each`: single slots. `full`: `plan-auto-approve` sleeps until `approval_due_at` (`approval_timeout_hours` after review starts) and approves the ready slots if the client hasn't; `needs_review` slots never go out without the client. Approving one slot schedules it straight away in every mode.

**Single ads ("Create an ad").** `POST /api/ads` adds one slot to the plan of the week it goes out in (made on the spot with `strategy.adhoc = true` when there is none) and runs the same chain with `oneOff`. The weekly Planner still plans a week that only holds single ads and keeps them.

**Client actions on a slot.** Approve, skip (`rejected`, with an optional reason), make again with a note ("make it punchier": the whole chain runs again with the note), edit captions, schedule again (after connecting a missing account). Every action is saved in `feedback` for the learning loop. Cancelling an agent post in Posts puts its slot back to `approved`.

**Rendering (`src/creative/`, our code).** `theme.ts` turns the brand kit into colour pairs that pass WCAG AA, loads the brand fonts from Google Fonts (kept in storage under `fonts/`, Inter as fallback) and picks the logo version per background. `templates/ads.tsx` has four layouts (`spotlight`, `split`, `frame`, `bold`) that work at 1:1, 4:5, 9:16 and 16:9 with safe zones; `templates/carousel.tsx` has the cover, content and CTA slides and the video end card; `fit.ts` sizes text to its box; `render.tsx` renders with Satori (`next/og`). `subtitles.ts` builds the burned-in captions (2–3 words at a time, the spoken word highlighted, big on-screen lines at the top, the hook first). `providers/ffmpeg/compose-video.ts` builds the one ffmpeg run: clips filled to the canvas → captions with the brand font (`fontsdir={dir}`) → end card → voice with music under it → loudness -14 LUFS. Manual "Create video" in Media uses the same composer.

**Notifications** (`core/notifications/`). `notify()` writes a `notifications` row and, when asked and a notification email is set, emails it through Resend (`providers/email/`). Until `EMAIL_ENABLED=1`, the email is built and logged, and the row says `skipped`. Sent for: plan ready, single ad ready or needs a look, posts scheduled, post failed, planning stopped, budget reached (once a month). The sidebar bell shows them.

**Screens.** `/week` (`modules/week/`): week switcher, plan banner (progress while the agents work, Approve, auto-approve countdown), the board (7 day columns), theme and pillar mix, "Needs you", live activity, slot detail (preview per platform, Why, Brief, Captions, Quality, Activity), "Create an ad". `/calendar` (`modules/calendar/`): month/week views of posts, planned slots and key dates; "Add a date" saves `calendar_events` (source `client`) for the Planner.

### Learning loop (agent 10, Performance Analyst)

`agents/performance-analyst/`. The maths is code (`score.ts`, checked offline); the AI only explains the numbers.

- **Daily** (`agent-performance-metrics`, 05:00 UTC, per business via `performance/sync`): metrics for every post target in its first 30 days from Zernio analytics (one paged list, then single lookups for the rest) → one `post_metrics` row per target per day (engagement rate = the provider's, else engagements ÷ reach/impressions/views); follower counts per connected account → `account_snapshots`.
- **Weekly** (`agent-performance-learnings`, Sunday 02:00 UTC per business, before the Planner; also `performance/learn` from "Update learnings"): latest numbers of every post from the last 90 days → baseline per platform (median of own posts once there are 10+, else the research baseline, else a platform default) → each post's score = engagement rate ÷ baseline (views when there is no rate, capped at 5) → learnings by angle, hook type, format, framework, lever, pillar, persona and posting time (overall and per platform; rejected slots count as 0.6 at half weight; confidence = n ÷ (n + 5); under 5 posts is an "early sign") → hook scores, and hooks scoring ≥ 1.5× become `own_winner` → why the best and worst video of the month did what they did (Twelve Labs, optional) → insights (AI; any insight without a number is replaced by a code-written one) → `weekly_reports` row and the weekly report notification (emailed).
- The Planner reads `learnings` on its next run: format weights, best posting times (10+ posts), and the learnings list in its prompt.

**Screens.** `/performance`: weekly report, KPIs vs the previous period, reach and engagement over time, platforms, top posts, "What's working", followers, approval rate. `/activity`: every agent step, filterable, paged. `/costs`: the month's spend vs budget, by agent, day, kind of work, asset and weekly plan. APIs: `GET /api/performance?days=7|30|90`, `POST /api/performance/learn`, `GET /api/costs?month=YYYY-MM`, `GET /api/activity?agent=&status=&before=`.

### Keeping the brand fresh

- **Logo change** (Settings → Business profile, after onboarding): a partial research run of the Visual Identity Analyst only (`startPartialRefresh`), which remakes the light and dark logo versions and the colours.
- **Client edits win**: changing colours or fonts in Brand → Brand kit sets `colors.manual` / `fonts.manual`; later research runs (logo change, Refresh brand) keep them.
- **Monthly** (`monthly-refresh`, 1st of the month 04:00 UTC): public holidays for the client's countries for the next 120 days (Nager.Date, free) become `calendar_events` (source `system`), and the Social & Market Analyst runs again (own posts, competitors, ads, hooks). Skipped while paused.
- **Ad layouts**: Brand → Brand kit → Ad layouts saves `brand_kit.template_ids`; the Creative Director only uses those (all four when none are picked).

### Pause

Pausing stops every agent step (budget guard) and, through `apply-pause` (`settings/paused-changed`), takes back posts already scheduled with Zernio: they wait as drafts with their time kept (target error "Held while Prodo was paused"). Turning Prodo back on schedules the ones whose time hasn't passed and tells the client about the rest.

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
- Database: RLS on every table, `authenticated` role only and only its own business (migration `0017`), no `anon` privileges (migration `0009`). Jobs and agents use `businessDb(businessId)` (service role, one business).
- Storage bucket `media`: public read; logged-in users may only create files in their own `<business id>/` folder; the server replaces and deletes files.
- Signups are off in Supabase Auth (keep "Allow new users to sign up" off); users are created in the dashboard, and each one gets its own business.

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

Offline checks (no vendors, no database): `npm run smoke scripts/check/research-logic.ts` (agents 1–4), `npm run smoke scripts/check/weekly-logic.ts` (time zones, Planner slots, brief checks, captions, compose arguments) and `npm run smoke scripts/check/learning-logic.ts` (engagement rate, baselines, scores, learnings). `npm run smoke scripts/check/render-samples.tsx <dir>` renders every ad layout, carousel slide and end card with a sample brand so the designs can be looked at.

`npm run smoke scripts/smoke/<name>.ts` makes one small real call and prints the result and its estimated cost: `openai`, `kie`, `elevenlabs`, `firecrawl [url]`, `scrapecreators [instagramHandle]` (one Google search; with a handle, also that profile and its posts), `twelvelabs [videoUrl]` (defaults to a 5 s sample), `zernio` (read-only), `ffmpeg-worker`, `agent-step` (writes one `agent_runs` row and checks a $0 budget blocks agents). Never fake a vendor response to make one pass.

Raw vendor error messages never reach the browser. Every `AppError` has a plain, user-facing message.

## Inngest Job Rules

1. Each outside call is its own step — retries only replay the failed step
2. Vendor retries disabled (`maxRetries: 0`) — Inngest is the only retry layer
3. Every fetch has a timeout (60s default, 5min for downloads)
4. Event ID = media/post ID — Inngest deduplicates double-clicks
5. `cancelOn` stops a run when the item is deleted mid-job (matching the item and the business)
6. Concurrency: per business 5 images, 2 videos, 3 plan slots, 1 plan, 1 research; 1 run per post
7. `onFailure` writes status + message to the DB row
8. `step.sleep` for polling — no server runs while waiting
9. Large files go to storage first; steps pass only the key (Inngest caps step output size)
10. Every event carries `businessId`; functions open the database with `businessDb(businessId)`

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
src/agents/weekly/                → the weekly loop around agents 5–9: produce-item (one slot end to end), plan-flow (cron, review, auto-approve), task helpers
src/creative/                     → our renderer: brand theme, text fitting, Satori layouts (ads, carousel, end card), captions (.ass)
src/core/plans/                   → plans and slots: types, queries, approval actions, week clock
src/core/creative/brief.ts        → the creative brief schema and limits
src/core/notifications/           → notify() (in-app + email), email layout
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
| `/api/plans?week=` (this, next or a date), `/api/plans/request`, `/api/plans/[id]/approve` | GET, POST | A week's plan with its slots; plan a week (again); approve a plan |
| `/api/plan-items/[id]` (GET, PATCH captions), `…/approve`, `…/reject`, `…/regenerate`, `…/schedule` | | One slot and the client's actions on it |
| `/api/ads` | POST | "Create an ad": one slot through the full chain |
| `/api/activity?planId=&itemId=` | GET | Agent steps (the activity feed) |
| `/api/notifications`, `/api/notifications/read` | GET, POST | The bell |
| `/api/calendar?from&to`, `/api/calendar/events`, `…/[id]` | GET, POST, DELETE | Calendar data; the client's own key dates |
| `/api/captions/improve`, `/api/elevenlabs/voices` | | Helpers |

## Key Design Decisions

- **Storage keys over URLs** — only `supabase-storage.ts` builds full URLs.
- **Connected accounts fetched live** — no `connected_accounts` table.
- **Captions at post time** — the same media can be reposted, and captions differ by platform.
- **All inputs saved** — `media` stores every generation input, plus `creative_spec`, so "Try again" reruns the same thing.
- **Products and services are offerings** — one table with `kind`, archived instead of deleted. Media points at an offering by id; a free-text "Other" product is kept in `creative_spec.product_name`.
- **Settings apart from brand facts** — `app_settings` holds autopilot, budget and pause, so agents only see brand facts.
- **Single profile API** — `PUT /api/profile` is multipart, fields + logo in one request.
