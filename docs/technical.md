# Technical Details

How Prodo works, flow by flow, and the rules the code follows. Tables and file locations are in [`database.md`](database.md); the video worker is in [`../worker/README.md`](../worker/README.md). All ten agents are built.

## Principle: code, AI, vendor

Our own code handles anything rule-based (maths, layout, rendering, scheduling, validation). The AI model handles judgement. A paid vendor is used only where our code can't do the job. All text on ads (headline, call to action, price, logo) is drawn by our code with Satori, never by the image model. Nothing in an image is clickable, so there is no button: the call to action is words with where to go.

## Services

| Service | Used for | Used by |
|---|---|---|
| OpenAI | Text, vision, embeddings (`text-embedding-3-small`, 1536 dims) | All agents |
| Kie | nano-banana pictures, Seedance clips (only where no real photo or video fits) | Producer, manual create |
| ElevenLabs | Voice-over with word timestamps, music | Producer, manual create |
| Zernio | Publishing, scheduling, connected accounts, per-post analytics. Replaces Upload-Post | Social & Market Analyst, Publisher, Performance Analyst |
| Upload-Post | Legacy publisher, kept registered so posts made before Zernio still resolve; fallback for small ffmpeg jobs | Publish jobs |
| Twelve Labs (Pegasus 1.5) | Watching videos: the client's own footage (usable moments), reference and competitor videos (hook, structure, pacing), the finished video (QA). No index needed | Visual Identity Analyst, Social & Market Analyst, QA Critic, Performance Analyst |
| Firecrawl | Website map, crawl, screenshots | Website Analyst, Visual Identity Analyst |
| ScrapeCreators | Public profiles and posts (Instagram, TikTok, YouTube), Meta and Google ad libraries, Google search. Replaces SerpAPI (see below) | Social & Market Analyst |
| Video worker (`worker/`) | Self-hosted on a **Hostinger** VPS. Remotion draws every video from our Timeline (9:16 and 4:5); ffmpeg levels the sound and runs small jobs | Producer, manual create |
| Resend | Email for notifications. Off until `EMAIL_ENABLED=1` (emails are only logged) | Notifications |
| Google Fonts | Brand fonts as files for our renderers (Satori and Remotion), cached in storage under `shared/fonts/` | Producer |
| Nager.Date | Public holidays per country (free, no key) | Monthly refresh |
| Supabase | Postgres, auth, pgvector | All |
| Cloudflare R2 | Every file: brand photos and videos, finished ads, voices, music, fonts, sound effects | All |
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

**SerpAPI was replaced by ScrapeCreators**: one key covers search, ads and public social data. Google Trends and Maps reviews are dropped for now; dates come from the client's answers and reviews from the website and the client.

`usage` is `{ provider, model, tokensIn, tokensOut, costUsd }`. Model names live in `src/config/models.ts`; estimated prices in `src/config/pricing.ts` (update them from each vendor's pricing page).

`providers/http.ts` gives every adapter the same plumbing: `request()` adds a timeout (60 s, 5 min for downloads; the language model gets 4 min, `LIMITS.modelTimeoutMs`, because a full video brief takes over a minute, and `/api/inngest` may run up to 300 s), and `statusError()` / `jsonOrThrow()` turn an HTTP status into a plain `AppError`.

### Publishing (`providers/publishing/`)

`Publisher` interface: `publishPhoto`, `publishVideo`, `publishText`, `publishCarousel` (optional), `getStatus(ref, platform)`, `cancelScheduled`, `listAccounts(db)`, `getConnectUrl(db, platform)` (`db` is the business's database: RLS client or `businessDb`). `registry.ts` maps provider names to implementations; `publisherFor()` with no argument returns the default, **Zernio**. Each `post_targets` row stores its provider, so old Upload-Post rows keep working.

Zernio (`https://zernio.com/api/v1`, Bearer key): one Zernio post per target (`POST /posts` with `publishNow` or `scheduledFor` in UTC), status from `GET /posts/{id}` per platform, cancel with `DELETE /posts/{id}`, accounts from `GET /accounts?profileId=`, connect links from `GET /connect/{platform}?profileId=`. When a target is published, `check-post-status` saves `provider_post_id` and `published_at`. Each business has its own Zernio profile (one Zernio API key for all): the first accounts or connect call creates one named after the business, tagged `externalId = prodo-<supabase ref>-<business id>` (a repeat create returns 409 and the existing id), and saves its id in that business's `app_settings.zernio_profile_id`. The profile id is read from the database on every call, never cached in memory. The account's default profile is never used. Accounts the browser picks for a post are checked against the business's own list (`ownTargets()` in `core/posts.ts`), and their name and provider come from Zernio. Upload-Post publishing has one profile for the whole deploy, so it stays legacy-only.

### Analytics (`providers/analytics/`)

`Analytics` interface, implemented by `zernio.ts`: `getPostMetrics(providerPostId)` (null while Zernio is still syncing), `getMetricsSince(date, page)`, `getAccountStats(accountId)`, `listPastPosts(accountId, limit)` (with media URLs when available). `analyticsFor()` returns it.

### Video rendering (`providers/ffmpeg/`)

Videos are drawn by **Remotion on our worker**: `submitRender("ad", timeline, outputKey)` sends a Timeline (`worker/remotion/shared/timeline.ts`, imported in the app as `@video/timeline`), `getJob` polls it. `videoReady()` / `renderReady()` need the worker (Upload-Post can't run Remotion), so without `FFMPEG_WORKER_URL` and `FFMPEG_WORKER_SECRET` no video is planned or started. See "Videos" below.

ffmpeg jobs (small tasks) still have two backends behind the same client (`submitJob`, `getJob`). New jobs go to **our worker** when `FFMPEG_WORKER_URL` and `FFMPEG_WORKER_SECRET` are set, otherwise to **Upload-Post's FFmpeg API** (`UPLOAD_POST_API_KEY`); `RENDERER` forces one. Job ids carry their backend and output key, so a job always finishes where it started. Connecting the worker later needs no code change.

Upload-Post (`backends/upload-post.ts`), rules found with real jobs: files go in as public URLs and the command uses `{input}` (first file), `{input1}`… and `{output}`; `; | & $` and backticks aren't allowed, so the filter graph is uploaded as a file (`-filter_complex_script`); placeholders aren't filled in inside that file, so captions are burned in by a second job (`-vf subtitles={input1}`) with Upload-Post's own font (the worker uses the brand font). The finished file is downloaded into our storage; working files live under `tmp/render-jobs/<id>/` and are removed afterwards. It uses Upload-Post's monthly processing minutes. Check it with `npm run smoke scripts/smoke/upload-post-render.ts`.

### Video worker (`worker/`)

A Node 24 service (Remotion 4.0.539 for renders, ffmpeg for sound and small jobs), deployed with Docker + Caddy (HTTPS) on a Hostinger VPS. See `worker/README.md`.

- `POST /render { template: "ad", props: Timeline, outputKey }` and `POST /jobs { inputs, args, outputKey }` (header `x-worker-secret`) return a job id at once; `GET /jobs/:id` gives `queued | running | done | failed`. One render and two ffmpeg jobs at a time.
- After each render one ffmpeg pass levels the sound to -14 LUFS and copies the picture unchanged, then the file is saved at `outputKey`.
- Inputs are storage keys or `https` URLs on our storage's public host (`R2_PUBLIC_URL`) or `ALLOWED_INPUT_HOSTS` (Kie result hosts). Anything else is rejected.
- ffmpeg runs with an argument list, never a shell string. Two jobs at a time, 10 minutes each. The result is uploaded straight to storage at `outputKey`, and temp files are deleted.
- `compose-video.ts` (one ffmpeg run for a whole video) is no longer used by the Producer or manual videos; both render with Remotion. It stays for the Upload-Post check script.

### Storage (`providers/storage/`)

Files live in **Cloudflare R2** (bucket `prodo-media`). R2 speaks Amazon S3's API; requests are signed with the R2 key through `aws4fetch`.

- `r2.ts` (server only): `upload`, `download` (null when missing), `deleteFiles`, `signedUploadUrl` (a 15-minute PUT link signed for one key and one content type).
- `paths.ts` (safe in the browser): where every file lives (`brandKey`, `logoVariantKey`, `mediaKey`, `workKey`, `tmpKey`, `fontKey`, `finalName`), the ownership checks (`inBusinessFolder`, `ownedBy`) and `publicUrl(key)`, the only place a key becomes a URL (`NEXT_PUBLIC_MEDIA_URL`). Everything else stores and passes keys.
- Public address: `r2.dev` during development (rate-limited); a custom domain (e.g. `media.<domain>`, DNS on Cloudflare) before launch. Changing it only changes `NEXT_PUBLIC_MEDIA_URL` (and the worker's `R2_PUBLIC_URL`), since rows store keys.
- Browser uploads: `POST /api/uploads` returns `{ id, key, url }` (the file is named by the id its row will get), then `useUpload` PUTs the file to `url` with its content type.
- Bucket rules: `npm run smoke scripts/setup/r2-bucket.ts [origin…]` sets auto-delete (`work/` after 90 days, `tmp/` after 7) and CORS (reading from any page, since the renderer fetches clips, music and fonts from its own local page; uploads only from localhost, `APP_URL` and any origin given). Run it for every new bucket and when the app gets a new address.
- Sound effects: `npm run smoke scripts/setup/sfx.ts` puts them in `shared/sfx/` (Remotion's CC0 whoosh, whip, click and shutter, plus pop, ding and rise made by our own code).
- Check it: `npm run smoke scripts/smoke/r2.ts` (upload, public link, signed upload, delete; free).

Layout (full table in `docs/database.md` → File storage):

```
<business id>/brand/logo|photos|videos|references/<id>.<ext>   kept
<business id>/media/<media id>/<ratio or slide>.<ext>            finished files, kept
work/<business id>/<media id>/…                                  in-between files, deleted after 90 days
tmp/…                                                            job and test files, deleted after 7 days
shared/fonts/<family>-<weight>.ttf                               font cache
shared/sfx/<name>.wav                                            sound effects for videos
```

Finished files and in-between files are kept apart so R2's auto-delete rules (by prefix) clean up the in-between ones; "Make again" can reuse them while they last. One media item's finished files are in one folder. Deleting a business means deleting `<business id>/` and `work/<business id>/`.

Logged-in users can only create files in their own brand folders (signed upload links from `POST /api/uploads`) and can't list or delete anything; replacing and deleting is done by the server (`removeFiles(businessId, keys)` in `remove-files.ts`), which only deletes the business's own files (`ownedBy`: `<business id>/` and `work/<business id>/`, or old unfoldered files for the business that owns them). A key sent by the browser must be in the business's folder or already one of its files (`assertOwnKey()`). Files made before multi-tenant keep their old paths.

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
| 1 | Website Analyst | Onboarding website scan (first screen), onboarding submit when the scan didn't read the site, Refresh brand | `brand_sources`, `brand_chunks`, `offerings`, `proof_items`, `offers` |
| 2 | Visual Identity Analyst | Onboarding website scan (colours and fonts only), onboarding submit, logo change; a video added in Brand → Assets (`watch-footage`) | `brand_kit`, `brand_assets.ai_description`, `brand_assets.analysis` |
| 3 | Social & Market Analyst | Onboarding, monthly refresh | `brand_sources`, `competitors.analysis`, `proof_items`, `calendar_events`, `learnings` (baseline), `hook_library` |
| 4 | Brand Strategist | After 1–3; on Regenerate | `brand_bible` (draft), `personas`, `content_pillars`, `hook_library` |
| 5 | Planner | Weekly cron, "Plan this week" (nothing is planned automatically right after onboarding) | `content_plans`, `plan_items` (with `style`) |
| 6 | Creative Director | Each new slot | `plan_items.brief`, `captions`, `hook_library` |
| 7 | Producer | Brief passes QA Gate 1 | `media`, `media_files` |
| 8 | QA Critic | Gate 1 after each brief, Gate 2 after each asset | `brief_score`, `qa_score`, `qa_report`, `selected_media_id` |
| 9 | Publisher | Plan or post approved, or timeout in full-auto | `posts`, `post_targets`, `notifications` |
| 10 | Performance Analyst | Daily metrics, weekly learnings | `post_metrics`, `account_snapshots`, `learnings`, `notifications` |

Agents 1–4 run at onboarding and on "Refresh brand"; 5–9 run the weekly loop (see Weekly loop); 10 runs daily and weekly (see Learning loop).

### Onboarding flow

```
website screen → onboarding/scan (reads the site while the client answers) → Your content → Basics → products or services → connect → review
→ submit → onboarding/started → [1 Website (skipped if the scan read it) ‖ 2 Visual ‖ 3 Social & Market] → 4 Brand Strategist
→ Brand Bible draft → client review (edit / regenerate / approve) → brand/approved (no plan is made automatically: the client plans from This week, or the weekly cron plans on its day when "Plan my week automatically" is on)
```

`business_profile.onboarding_status`: `not_started → collecting → analyzing → review → done`. The first saved step sets `collecting`; submit sets `analyzing`.

**Routing.** After login, `(app)/layout.tsx` sends anyone not `done` to `/onboarding`; `onboarding/layout.tsx` sends `done` users to `/week` (home; the old Dashboard was removed). `/onboarding` resumes at the furthest saved step (`business_profile.onboarding.step`; a new business starts at `website`), or `/onboarding/progress` after submit. Steps beyond the furthest one redirect back. Both layouts read the session through `getSession()`, cached per request.

**Data flow.** `onboarding/layout.tsx` loads the full draft once on the server (`loadOnboarding`, one round of parallel queries) into a Zustand store. Moving between steps makes no requests. Continue runs `useStepSave`: drop empty list rows → validate with the step's zod schema (field errors under keys like `products.0.name`) → `PUT /api/onboarding/{step}` → merge the server's copy of that slice back. Unsaved edits on other steps stay in the store.

**Steps.** `website` (start screen, not numbered) → 1 `content` (Your content) → 2 `basics` → 3 `business` (products or services) → 4 `connect` → 5 `review`. Order in `src/core/onboarding/steps.ts`. The old "Style & rules" step is gone: tone and rules moved to Basics, posting plan, voice, music and competitors to Your content, autopilot to Settings (defaults apply).

**Website scan.** Saving the website (`PUT /api/onboarding/website`) writes `onboarding.scan = { id, website, state: running }` and sends `onboarding/scan` (event id = scan id). `src/jobs/onboarding-scan.ts` reads the site while the client answers Your content: the Website Analyst's read (`agents/website-analyst/read-website.ts`: map, read, embed, facts, merge; found products also get `in_stock` and their image links) → one AI call for the Basics answers (`website-analyst/profile.ts`; fills only empty fields) → socials → logo (only if none) → colours and fonts (`visual-identity/brand-kit.ts`) → photos of the found products (5 main in-stock products, 2 photos each, saved as `brand_assets` with `source_id`; page text has no image links, so photos come from each product page's schema.org Product data, Shopify's free `/products/<handle>.js`, or its share image) → `scan.filled` (Basics fields it filled, shown with a "Filled from your website" badge), `scan.soldOut`, `state: done`. It writes the scan with `set_scan_state` one key at a time; the client's saves merge their keys with `merge_onboarding`, so neither overwrites the other. A newer website cancels a running scan. Steps log to `agent_runs` as `website_analyst` with `run_id` = scan id.

While the scan runs, the browser polls `GET /api/onboarding` every 4 s (`useWebsiteScan`); when it finishes, Basics and the products or services take the server's copy unless the client edited them, and an unanswered "What do you sell?" takes the scan's answer even while Your content is being edited. Basics and the business step show "Finishing reading your website…" until then, with "Fill it in myself" to skip waiting. When the site can't be read (down, blocked or a wrong address) the scan ends `failed` with its reason on `onboarding.scan.error`, and Your content and Basics show it (`ScanFailed`): nothing was filled, fill it in by hand or go back and try the website again. After submit, the Website Analyst treats an unreadable site the same way: it finishes with "Skipped: reading the website (…)" instead of failing, so the Brand Strategist still writes the Brand Bible (account-wide errors such as no Firecrawl credit still stop it).

**Found rows.** Products, services, offers and reviews the scan found load into the wizard with `found: true` (a "Found on your website" badge; found products start folded). Saving the step confirms them (`active = true`, `verified = true`); removing one rejects it (`active = false`, `verified = true`), so a later read doesn't offer it again. Sold-out products stay out and are listed with "Add them anyway".

**Data checks.** Shops convert prices to each visitor's currency, so a found price in a currency other than the scan's usual one is left empty. Chat, social and payment widget colours (WhatsApp green, PayPal…) never become brand colours. Disclaimers are at most 3 notices an ad must carry (customs, results vary), not shipping prices or times.

**Limits** (`src/config/limits.ts`). Each read adds at most 5 new main products or services (in stock, best-ranked pages first, so the homepage's featured ones lead), plus up to 5 sold-out ones kept hidden. A business can have up to 15 products or services and 3 real photos per product; the client adds the rest by hand.

**Where answers go**

| Step | Saved to |
|---|---|
| Website | `business_profile.website`, `onboarding.scan` |
| Your content | `business_profile.business_type` ("What do you sell?", asked first because the style names and the business step follow it; the scan fills it when it's empty), `business_profile.content_prefs` (goals, mix, image and video styles, people, logo), `primary_goal` (= first goal), `posting_prefs`, `voice_id`, `music_mood`; `competitors` (client rows, `relation` competitor or inspiration); `brand_assets` (person, general, reference_image, reference_video); `brand_sources` (kind reference, one per pasted link) |
| Basics | `business_profile` (name, logo_key, description, website, social_urls, countries, cities, language, timezone, industry, currency, primary_cta, cta_links, tone, compliance), `brand_kit` colours and fonts (through `saveKit`, so a change marks them as the client's) |
| Products | `offerings` (kind product), `brand_assets` (product_photo), `offers`, `proof_items` (review, link kept as a `brand_sources` row with the same id), `calendar_events` (source client) |
| Services | `offerings` (kind service, details in `attributes`, FAQs as `objections`), `proof_items` (case_study, certification, award), `brand_assets` (team, location, work; case study photos tagged `case:<id>`), `cta_links.lead_magnet`, area/years/FAQs in `onboarding` |
| Connect | Accounts are read live from Zernio. Only the client's profile id is stored (`app_settings.zernio_profile_id`) |

Removed list items: offerings and offers are archived (`active = false`; found ones are rejected, see above); reviews, case studies, credentials, dates, competitors, reference links and assets are deleted (asset files too).

**Video sound.** There is no sound question: each video style has its own sound (`VIDEO_STYLE_SOUND` in `core/onboarding/options.ts`), and Your content asks for a voice only when a picked style uses a voice-over and for a music mood only when one uses music (both when none is picked).

**APIs.** `PUT /api/onboarding/[step]`, `POST /api/onboarding/submit` (sends `onboarding/started`, event id = run id), `GET /api/onboarding` (the whole draft; polled during the scan), `POST /api/uploads` (signed upload link). CSV import is parsed in the browser. Settings → Business profile (`/api/settings/profile`) edits the profile fields and goals with `businessProfileSchema` and `saveProfile`.

**Submit.** Sets `onboarding_status = analyzing`, writes `onboarding.research` (all agents queued; the Website Analyst is marked done when the scan already read the same website) and sends `onboarding/started` (event id = attempt id, so a double submit runs once). The client moves to `/onboarding/progress`.

### Brand research

`onboarding-run` (`src/jobs/onboarding-run.ts`) runs the agents in parallel with `step.invoke`. Each agent is its own Inngest function made by `defineResearchAgent` (`src/agents/research/define.ts`): it marks itself running, loads the business context, runs, and records a one-line summary (or its error, in `onFailure`). One failed agent doesn't stop the others. When all three succeed, the Brand Strategist (agent 4) writes the Brand Bible draft; during onboarding the run then sets `onboarding_status = review` (after onboarding, "Refresh brand" leaves it `done`).

| Agent | Folder | Steps | Writes |
|---|---|---|---|
| 1 Website Analyst | `agents/website-analyst/` | map site → rank up to 15 pages by URL shape (code): at most 4 single product or service pages and 3 collection pages; sale pages, about, reviews, contact and shipping or refund policies are always worth a place; site maps, .md files and legal pages are skipped → read each page (Firecrawl) → embed the pages without passages → pull facts (AI, zod) from the pages without them → merge: near-identical names matched in code, then one AI check that drops repeats across pages and items the client already entered (it only drops, never rewrites) | `brand_sources` (web_page), `brand_chunks`, `offerings`, `offers`, `proof_items` (extracted rows inactive/unverified, with `source_id`) |
| 2 Visual Identity Analyst | `agents/visual-identity/` | homepage HTML, CSS and screenshot (Firecrawl) → logo palette and light/dark versions (sharp, node-vibrant) → brand colours and WCAG AA text pairs (code: a CSS variable counts only as often as the page uses it, so a UI kit's unused defaults like shadcn's `--sidebar-primary` and error, warning or success colours never become the brand's, and a website colour used under 3% as often as its main colour isn't picked); all skipped when the onboarding scan already read the same website and logo → photo and layout style (AI vision, with up to 3 of the client's reference images) → one line per photo without one (AI vision, 8 per call, up to 48) → the client's own videos watched for usable moments (Twelve Labs, new videos only, up to 6; see Videos) | `brand_kit`, logo variants in storage (`<business id>/brand/logo/<id>-on-dark.png`), `brand_assets.ai_description`, `tags` and `analysis` |
| 3 Social & Market Analyst | `agents/social-market/` | social profiles the client left empty, taken from their homepage links (skipped when the scan did it) → own posts (Zernio when connected, otherwise public profiles) → baselines and top/bottom 20% (code) → competitors: find if fewer than 2 rivals (Google search + AI); each rival (max 5): 12 Meta ads, 12 Google ads, 8 top Instagram posts, homepage → summary (AI); brands the client admires (`relation = inspiration`): top Instagram posts only, no ads or gaps → the client's reference links (ScrapeCreators, up to 10) → videos (Twelve Labs: up to 6 own, plus 5 others: 2 references, then each rival's longest-running Meta video ad or a top Instagram video, then brands they admire) → what reference videos do well (kept on `brand_sources` kind reference) → hooks (AI; `reference` source for references and admired brands) | `brand_sources` (social_post, competitor, reference), `brand_chunks`, `learnings` (baseline, format), `competitors` (+ discovered), `hook_library` |

Rules every agent follows:
- One `task(id, work, summary)` per outside call (a few make two dependent calls, e.g. find a Meta page, then read its ads). Every task is logged to `agent_runs` with `run_id` = the research id, its cost and a plain summary.
- Work the agent can do without (one page, one competitor, one video) is wrapped in `optional()`: after Inngest's retries it's skipped, with its exact reason, and the agent's summary ends with what it skipped ("Skipped 2: watching a video (…); reading a.com/old (…)"). Pass `failed: skipped.note("what it was doing")`.
- An error about the whole account (no credit, a wrong key or setting, a daily cap, the budget, the pause switch) is never skipped: `optional()` stops the agent with that message, because every later step would fail the same way. The exception is a service the agent can do without, marked `anyError: true`: Zernio's account list, Twelve Labs watching videos, Firecrawl reading the homepage design (the logo still gives colours); in the weekly loop, Twelve Labs explaining video results, Zernio follower counts, ElevenLabs music and the second QA check.
- A page whose text hasn't changed keeps its passages and facts (`saveSource` keeps `metadata.facts`). A page whose passages or facts never finished (an earlier try failed) is processed again even if its text is the same, so a retry redoes only the missing work.
- Hard caps: 15 pages, 5 competitors, 10 reference links, 6 own posted videos, 5 other videos, 6 footage videos to watch, 48 photo descriptions, 50 posts per platform.
- Pages the site no longer has (missing from the site map and answering 404 or 410) are removed with their Brand Brain passages on the next read; facts found on them keep their row.
- Brand Brain passages can be older than what the client edits in the app. The Creative Director is told product, offer and review facts win, and a code check rejects any price in a brief that isn't the product's current price or an amount in the live offer or a review.
- The research right after onboarding reuses what the website scan did (kit, socials); "Refresh brand" later reads everything again.
- References and admired brands are direction, never facts: they stay out of the Brand Brain (which agents cite) and reach the Strategist only as market notes. The Creative Director only picks the client's own photos, never reference images.
- The Strategist also gets the "Your content" answers (goals, formats, styles, people) and the industry; health, beauty and finance add their claim words to the never-say list (`src/config/industry-rules.ts`).
- Prompts and their zod schemas live in `src/prompts/agents/`. Pure logic (ranking, chunking, colours, baselines) has its own files and is checked offline by `npm run smoke scripts/check/research-logic.ts`.
- Facts only: extracted offerings, offers and proof keep `source_id` and wait for the client (`active = false`, `verified = false`). Competitor findings stay on `competitors.analysis` and `competitor` sources, never in our facts or Brand Brain chunks.

**State.** `business_profile.onboarding.research` = `{ id, attempt, state: running|failed|done, startedAt, finishedAt, error, agents: { <agent>: { state: queued|running|done|failed, summary, error } } }`. Agents write it in parallel through `set_research_state(path, value, p_business_id)`, one atomic update each.

**Progress screen** (`/onboarding/progress`). `GET /api/onboarding/progress` returns the state, the last 40 logged steps, steps done per agent, cost so far and `stale` (running but nothing logged for 20 min). The page polls every 3 s while running and stops when done or failed. Closing, reloading or coming back later shows the same state from the server.

**Retry.** `POST /api/onboarding/retry` (allowed when failed or stale) keeps the research id, makes a new attempt id and runs only the agents that aren't done. Pages already embedded and read aren't paid for twice; pages whose embedding or fact reading failed last time are done again.

### Brand Strategist and Brand Bible

Agent 4 (`agents/brand-strategist/`) runs after agents 1–3, and again on "Regenerate with a note" (`brand/regenerate` → `regenerate-bible` invokes it with the note).

load facts (answers, offerings incl. pending, proof, kit, market notes) → search the Brand Brain once per section (`match_brand_chunks`) → write core sections (AI) → personas and pillars (AI) → code checks → save draft → seed 10–15 hooks (AI, `hook_library` source `generated`).

- **Sources.** The model sees numbered sources: `[A]` the client's answers, `[O]` offerings, `[R]` proof, `[K]` brand kit, `[C]` Brand Brain passages, `[M]` market notes (competitor gaps, baselines; context only, never citable). `sources.ts` maps cited labels back to refs (`answer:<key>`, `offering:<id>`, `proof:<id>`, `kit`, `chunk:<id>`). Edits by the client add `client`.
- **Checks** (`checks.ts`, code): a claim with no real source is dropped; never-say words (the client's avoid list + the model's) can't appear anywhere; 3–4 personas and 4–5 pillars, otherwise a retryable error; pillar shares rescaled to add up to exactly 1; offer stack only uses known offerings and marks website finds as pending.
- **Versions.** Every draft (generated or edited) is a new `brand_bible` version; older drafts become `superseded`, so there's one draft at a time. Approving: the previous approved version is superseded, the draft's personas and pillars replace the active rows (old ones archived), `onboarding_status = done`, and `brand/approved` is sent. It no longer starts a plan: posts cost money, so the first week is made only when the client asks (This week) or the weekly cron reaches the plan day.
- **Facts to confirm.** Offerings, offers and proof the Website Analyst found (`verified = false`) are listed for Confirm / Reject (`core/brand/pending.ts`). Rejecting an offering also removes it from the draft's offer stack.

**Review screen.** `/onboarding/bible` during onboarding (shown after research; `analyzing` only allows `/onboarding/progress`, `review` allows progress and bible), and Brand → Brand Bible afterwards. Same component (`modules/brand/components/bible/BibleReview`): read every section, "Show sources" on each statement, confirm found facts, edit (saves a new version), regenerate with a note, approve. Approving during onboarding opens This week.

### Brand Hub and Settings

**Brand** (`/brand?tab=…`, `modules/brand/`): Brand Bible (with version history), Offerings, Offers, Proof, Photos and videos (the client's own, people, and posts from other brands they like; their own videos show how many usable moments were found), Personas, Pillars, Competitors (with the research's analysis; "Found by Prodo" for discovered ones), Brand kit. Every list is defined once in `core/brand/resources.ts` (fields, archive or delete, verify); the API (`/api/brand/resources/[resource]`) and the forms are built from it. Brand rows are archived, never deleted, and can be restored. Editing a row an agent found counts as confirming it.

**Refresh brand** runs a new research (new research id, all four agents); its progress shows on the Brand page, and the approved Bible stays in use until the new draft is approved.

**Settings**: Business profile (name, website, logo, description, socials, market, language, timezone, industry, currency, goals; `/api/settings/profile`), Content (images or videos, image and video styles, people, voice and music, logo, where customers go; `/api/settings/content` → `core/content/settings.ts`, which writes the same columns onboarding does), Automation (`app_settings`: pause, autopilot mode, plan day and time, posts per week, auto-approve timeout, monthly budget with this month's spend, notification email), Connected accounts. Products live in Brand → Offerings; `/api/offerings` is read-only (Create Content's picker).

### Videos (Remotion)

The whole video flow, from the client's answers to the rendered file:

1. **Onboarding and Settings → Content** give the styles (in order), the content mix, people, music mood, logo and next step (`core/content/prefs.ts`).
2. **The client's own videos** are watched once by Twelve Labs (`agents/footage/watch.ts`: in the Visual Identity Analyst, and the `watch-footage` job when a video is added in Brand → Assets). The log (`brand_assets.analysis`) lists usable moments: times, what they show, shot, people, whether someone talks to camera (with their words and times), where the subject is and where text can go. Other brands' videos (`reference_video`) are only studied for pacing and structure (their lessons reach the Creative Director), never used as footage.
3. **Planner** gives each video slot a style. Talking to camera and customer videos stay real when the client has a talking moment (`hasTalkingFootage`), otherwise they become voice-over explainers.
4. **Creative Director** fills the style's **storyline** (`core/creative/video.ts`: a fixed opening and close, a flexible middle) with scenes from the **scene library** (hook, problem, product, detail, benefit, step, stat, review, offer, before, after, reveal, process, talking, result, cta). Each scene picks its picture: a moment of the client's video `[V…]`, one of their photos `[G…]` or AI; plus key words, an optional sticker, a stat or review (facts only), the price (facts only) and the feel of the cut. The **sound** follows the style: music only, a voice-over, voice over music, or real speech from talking moments. The **look** (preset) is chosen by code from the brand's tone sliders and industry (`creative/video/preset.ts`). Code checks the storyline's shape, timing, footage length, facts behind numbers and sticker count (`checks-video.ts`).
5. **Producer** (`agents/producer/video.tsx`): voice for voiced scenes → AI stills only where no real picture was chosen (product scenes use the real product photo as reference; a reveal's "after" is made from its "before") → AI clips for moving scenes (card scenes and slideshows keep stills) → everything copied into `work/` → music → one vision call for where the subject and the calm area are (`prompts/agents/scene-layout.ts`; real moments use their footage log) → a Timeline per size (`creative/video/timeline.ts`) → rendered on the worker. A QA redo remakes only the failed AI scenes.
6. **QA** (the check of the finished video is **off for now**: change `VIDEO_QA` to `true` in `config/video-qa.ts` to bring it back. Off, the video is `ready` as soon as it is rendered: no Twelve Labs watch, no Gate 2, no remaking of scenes; the Quality tab shows only Gate 1): Gate 1 judges the brief against the client's choices and the sound; Gate 2 has Twelve Labs watch the finished video (our captions, cards and real footage are expected) and checks AI stills for painted-in words.

**Timeline rules** (all from data, `creative/video/timeline.ts`): scene length = its voice + a breath, its talking moment, or the brief's seconds; voices run back to back and transitions sit in the pauses; captions come from the voice's word timings (talking moments: their lines spread over each line's time) in pages of 1–3 words with key words lit; captions always sit at the bottom, in the same place in every scene and every video (the bottom margin is `CAPTION_BOTTOM` in `worker/remotion/ad/layout.ts`, 16% of the height), whatever is behind them: nothing moves them and nothing is drawn behind them; the on-screen line takes the calm band the picture analysis found, never the captions' band; stickers and price tags appear beside the subject at the moment their key word is said; the stat counts up when its number is said; sound effects sit on transitions, text, reveals and the closing card; music ducks under every voice and talking clip; the closing card ends every video; video safe areas keep text out of the platform buttons (9:16: 260 px top, 620 bottom, 90/110 sides).

**Reference photos in videos**: a product photo gives the scene pictures the product only (`REFERENCE_LINE` in `agents/producer/photos.ts`, also used by manual videos): any person in them is a new person, and the reference model's headwear, jewellery, props and background are left out. Only a person or team photo keeps its real person; a reveal's "after" keeps its own "before" exactly. The Creative Director is told the same when it writes a scene's `visual`.

**Direct video (the way videos are made now, `config/video-direct.ts`, `VIDEO_MODE = "direct"`).** Every video, from Auto-create, This week → Create an ad, Media → Create → Video and Copy a video, goes through `weekly/produce-video-direct.ts` instead of the scene pipeline below (which stays in the code: set `VIDEO_MODE = "scenes"` to bring it back). Two steps: (1) one OpenAI call (`prompts/agents/video-direct.ts`) reads the same context as the Creative Director (business, voice, market, audience, product, offer, reviews, website passages, links, the owner's style, people, music mood and logo choice, a reference video's breakdown when copying) and looks at the product photos, then writes a title, hook, message, length (4–30 s), the post text per platform and one detailed prompt for the video model: the video, the brand and product, what each reference image is, the people, a timed timeline, every spoken and on-screen word, captions for speech, sound, the logo and the ending, and that the timeline is a plan the model may improve; (2) one Seedance 2.5 job on Kie (`bytedance/seedance-2-5`, `ai.videoFull`, 9:16, 480p, sound on) with the product photos (up to 4) and, when the owner shows their logo, the logo last, each redrawn to Seedance's size rules. Its video is final: no scenes, Remotion, worker, captions from code or QA, and the post is `ready`. About $0.14 per second at 480p (a 30-second video about $4.20; 720p, a setting in `config/video-direct.ts`, would be $0.315 a second). The Brief tab shows the prompt the model got. **Services** get the same path (`direct-context.ts`, shared with direct image ads): the post's offering is named SERVICE with its price as set (from, per hour, monthly or package, on request), what's included, turnaround, how it works and where it's offered (`offerings.attributes`), plus the years in business; case studies, certifications and awards go with the reviews; with no photos of its own, a service post gets the business's own work, place or team photos, labelled as such. The style lines (`DIRECT_STYLES`, `IMAGE_BRIEFS`, `VIDEO_BRIEFS`) and the people rules cover a product or a service. **Creative bar, still two OpenAI calls:** the Planner picks only the product, persona and angle (no concept: its seed set a plain idea the writer only expanded); the prompt writer imagines three different concepts from the angle and everything it knows, develops the best to agency level with no generic phrases, and returns the chosen concept (shown in the Brief tab) and the two it beat. Its only fixed knowledge is the truth rules (without the AI-label line, set when posting) and the post-text rules: the shared hook, script and filming rules were made for short clips our code joined and kept these videos plain. The Planner sees how many posts each product had in the last 3 weeks and the product of each recent angle, and spreads the products, so the hero doesn't take every post. In direct mode the talking styles (talking to camera, customer review) rotate in without the client's own talking footage, unless the owner chose no people. The writer gets the full context and the goal (creative, energetic, a lot happening, never slow or plain, agency level) but no fixed structure, examples or text rules: it decides the shots, words, captions and ending itself. Claims stay factual; the staging is invented freely; the platform's AI label is handled when posting. **Copy a video, music:** our worker cuts the reference's sound track (up to 30 s, WAV) and Seedance gets it as `reference_audio_urls` with a line saying to use it as the music. Seedance checks the sound only after making the video; when it blocks it for copyright, the video is made once more with new original music (a failed job uses no credits). The platforms may still mute or block a video that keeps another brand's music.

**Ad library (Copy a video → Ad library, `VideoToCopy`, `AdLibraryPicker`).** A window searches the Meta Ad Library for video ads running now, whose words match a search (a brand name or any words), in the business's main country by default (or any country, or all). Cards show the first frame (it plays in place), the brand, how long the ad has run (a long-running ad sells), its words and where it runs; "Use this ad" puts it in the form and "Change" opens the window again. `GET /api/ad-library` (`core/ad-library.ts`): ScrapeCreators' `/v1/facebook/adLibrary/search/ads`, active video ads only, most seen first, one version per ad (collation id), 1 credit a page. To spend as few credits as possible: a search runs only when Search is pressed (never while typing or on its own), the next page only on "Show more", each page is kept 48 hours in `ad_library_searches` (0027) and read from there for free (the same search, going back, another tab), and a business makes at most 30 live calls a day (UTC; the window shows how many are left). Each live call is an `agent_runs` row (`agent = ad_library`), so it shows on the Costs screen and counts toward the monthly budget. A picked ad is sent as its Ad Library link; when the post is made, the video link kept with the search is tried first (no call), and only if it has expired is the ad read again (1 credit). A video copied before from the same link gets the earlier breakdown copied onto its new `reference_videos` row, so Twelve Labs doesn't watch it again.

**Reading a reference video (Copy a video).** The video comes from an upload, a pasted link or an ad picked in the Ad library (`core/brand/reference-link.ts`: a Meta Ad Library ad through ScrapeCreators' `/v1/facebook/adLibrary/ad`, an Instagram, TikTok or YouTube post through its post reader, or a direct video file), and waits in `tmp/<business id>/reference/` while it's read (R2 deletes it after 7 days; only its breakdown is kept). It is read twice, each reading trusted only for what it does best, and merged by code into one breakdown (`mergeReference`), so the prompt writer never sees two versions of the same thing: Twelve Labs watches and listens (summary, pacing, voice, every spoken line with its time and speaker, music with tempo, instruments and changes, effects); our worker takes a frame every 0.5 s (more spaced for long videos, at most 48), our code lays them on timed contact sheets and one OpenAI vision call writes the exact cut list (times, framing, camera, people, action, on-screen words with place and style, transitions), the look and the ending. Spoken lines are placed in the scenes by time. Without the worker the Twelve Labs scenes are used. The prompt writer keeps the reference's speech type (on camera stays on camera with lip sync, a voice-over stays a voice-over, new words for this brand) and asks for new original music with the same mood, tempo and changes, never the same track.

**Lengths.** The Creative Director decides how many scenes a video has (3–12) and how long each one lasts, from a flash of under a second up to 15 seconds (`LIMITS.sceneMaxSeconds`, the longest clip Seedance 2 mini makes); the whole video is at most 50 seconds (`LIMITS.videoMaxSeconds`) and as long as the idea needs. Each style is one line saying what kind of video it is (`STORYLINES`), not a fixed sequence, and any scene kind can be used. The clip model makes 4 seconds at least, so a shorter scene uses the start of its clip; a voiced scene lasts as long as its line.

**Copy a video** (This week → Create an ad → Copy a video, and Media → Create → Copy a video): the owner gives a video they like (Upload, Paste a link, or Ad library, see below) and picks one of their products; nothing else is needed (no idea, style or persona: the post's angle is fixed text, its style is empty and the VIDEO STYLE line is left out). An optional "Changes you want" box adds the owner's changes to the angle ("The owner's changes: …"); the video writer makes them over the reference and follows the reference everywhere else. **Reference image (image ads):** "Create an ad" and Media → Create → Image take one optional ad image the owner likes (upload purpose `referenceImage`, kept in `tmp/`, `plan_items.reference_image_key`, 0026). Direct image ads attach it first, labelled as another brand's ad to make the same way (layout, composition, style, colours, type, mood) without copying its brand, logo, words, people or products; once storage has deleted it, a redo is made without it. The other image modes don't use it yet. It is saved as a `reference_videos` row (0025: upload or link, the pasted link, its platform, what the link's page said about it (text, account, views, likes, comments, shares, saves), the product as `offering_id`, the file's temporary key) and linked by `plan_items.reference_video_id`. When the video is saved, the row gets its `media_id`. Videos people liked enough to copy say something about what works, so these rows and their breakdowns are kept for later learning, while the files are not. Before the brief, `produce-plan-item` has Twelve Labs break it down once (`creative-director/reference.ts`, `prompts/agents/reference-video.ts`): every scene with its times, what it shows, shot, camera, people, action, on-screen words with their place and style, spoken words, transition and purpose, plus the pacing, look, voice, music, effects, captions and ending. The breakdown is saved on `reference_videos.analysis` (with `summary`, `duration_sec` and `analyzed_at`), so Make again reuses it even after the file is gone; the reference's own music is then left out, because it comes from the file. The Creative Director gets it as REFERENCE VIDEO, ahead of the style, and makes the same video for the product (the same scenes and lengths, up to 20 scenes, within 50 seconds) with this brand's facts and words; the video's sound follows the reference (voice-over, music, or the client's own talking footage).

**Real photos in videos**: in every style except before/after a real photo is never shown as it is (the photo slideshow is made of AI stills of the product too). The Creative Director makes an AI scene and names the photo it takes its product from (`reference`, kept as `source.referenceAssetId`; `checkBrief` sends a bare photo scene back), and the Producer sends that photo with the product-only rule above. The prompt asks for a new place, pose and moment in every scene, with one described person, one look and one light so the scenes belong together.

**On-screen line and captions placement**: the Creative Director (AI) writes each scene's on-screen line (`overlay`); code decides where it goes. Captions are the spoken words, always at the bottom. A scene with captions puts its line in the calm band (top or middle); a scene without captions (music-only videos) puts its line low, where captions would be. Faces are never kept out of a picture to avoid talking: voice-over scenes only need a calm expression, mouth closed.

**Sound effects**: `shared/sfx/` in storage (`npm run smoke scripts/setup/sfx.ts` puts them there): Remotion's CC0 whoosh, whip, click and shutter, plus pop, ding and rise generated by our own code. The bucket allows reads from any page (the renderer fetches clips, music and fonts from its own local page); uploads only from the app.

**One system for every way in.** Auto-create, This week → Create an ad and Media → Create (Image and Video tabs) all make a one-off or planned slot and run it through the same chain (Creative Director → QA → Producer → QA); the Media tabs call `POST /api/ads`, like Create an ad, with the idea, the product and an optional style. Voice, length, language, sound and look come from Settings → Content and the style, never from a form. `jobs/generate-video.ts` and `jobs/generate-image.ts` stay only to redo or retry media made before this change.

Checks: `npm run smoke scripts/check/video-logic.ts` (offline), and `scripts/check/video-timeline.ts` + `worker/scripts/render-local.ts` to render a real brand's timeline on your own computer (free).

### Weekly loop (agents 5–9)

**The client's content choices.** `core/content/prefs.ts` (`contentRules()`) reads the onboarding answers (`business_profile.content_prefs`, `primary_cta`, `music_mood`, `industry`) into one set of rules every weekly agent uses; `core/content/styles.ts` says what each style means (formats it fits, sound, people, a description for the AI). The client changes them in Settings → Content (`/api/settings/content`), and goals in Business profile.

| Choice | Where it acts |
|---|---|
| Goals (ranked, up to 2) | Planner: the first goal gets about two thirds of the slots and each slot names its goal; each slot gets an objective from its goal's mix (awareness, converting, retargeting; see Creative knowledge base) and the funnel stage follows it. The Creative Director and QA see both |
| Images or videos (`mix`) | Planner: video share 0 / 15% / 45% / 70%; images only also drops video-only platforms. A format meant for more than half the posts may repeat back to back |
| Image and video styles (ranked) | The Planner's code gives each slot a style (`plan_items.style`): only styles that fit the format (tips → carousel, offer → single image), higher picks more often, learnings (`style` dimension) adjust, never the same twice in a row. A format with no fitting style isn't planned; no picks = any style. The Creative Director follows the style; QA judges against it |
| Video sound (from the style) | Music only (showcase, before/after, slideshow, behind the scenes): no voice-over, scenes have set lengths. Voice only: no music. Talking to camera and customer videos use the client's talking moments with their own sound; without one they're made as voice-over videos. A photo slideshow builds every scene on the brand's own photos |
| People (real / AI / none) | None: no people styles, no person photos offered, image and clip prompts say no people, and a code check sends back briefs that describe a person. Real: people only from the client's own photos |
| Logo (every / never) | Never: our layouts draw no logo (closing frames show the business name) and `media.use_logo` is false. Manual ads keep their own "use logo" box |
| Customers' next step (`primary_cta`) | The Creative Director points every call to action there; the brief's link defaults to it (`phone` is a CTA link now) |
| Music mood | Overrides the mood the Creative Director suggests |
| Industry | Its never-say claims join the client's own list in the brief checks and QA |

```
weekly cron (hourly, one `plan/check-due` per business; fires on that business's plan day and hour, in its time zone, only when Settings → Automation → "Plan my week automatically" is on: `app_settings.auto_plan`, off by default, 0028) or "Plan this week"
→ plan/requested → 5 Planner → plan-item/produce × N
→ per slot: 6 Creative Director → 8 QA Gate 1 (≤ 2 rewrites) → 7 Producer → 8 QA Gate 2 (≤ 2 targeted redos) → ready | needs_review
→ plan-item/settled → all settled: plan → review, notify (in-app + email) → client approves (or full autopilot after the timeout)
→ plan/approved | plan-item/approved → 9 Publisher → posts + post_targets → publish-post → check-post-status → slot published
```

Each slot is one run of `produce-plan-item` (`agents/weekly/produce-item.ts`, 3 at a time, cancelled by `plan-item/cancelled`). Every outside call is an `agentStep` logged against the plan (`run_id = plan_id`), the slot and its media, so `/week` shows live activity and the cost per post.

| Agent | Folder | What | Code does | AI does |
|---|---|---|---|---|
| 5 Planner | `agents/planner/` | Plans one week | Slot count from posts per week (Settings → Automation) minus the posts already set for those days, days spread around them, platforms per slot, local posting times (defaults until learnings have 10+ posts), format mix from the client's content mix, weighted by learnings and supported by every platform in the slot, a content style and goal per slot, pillar mix by largest remainder, 30% experiments, no back-to-back repeat of format, offering or angle on a platform, offers only while live | Offering, offer, persona, angle, objective, hook type, levers and the reason per slot; the week's theme |
| 6 Creative Director | `agents/creative-director/` | One slot → a brief (`core/creative/brief.ts`) | Numbered fact book (`[O1]` offering, `[F1]` offer, `[R…]` verified proof, `[C…]` Brand Brain passages, `[G…]` real photos, `[V…]` the client's video moments); for videos the storyline, sound and look of the slot's style; labels → stored refs (V → a clip with start and end, G → a photo); claims, badges and fact levers without a source dropped; word limits (headline 8, overlay 7, slide title 8, body 30, ~2.5 spoken words/s), caption length per platform, never-say words, no urgency without a live offer; one rewrite when a check fails; hook swapped when ≥ 0.9 similar to one used in 60 days (`match_recent_hooks`); hook saved to `hook_library` | 8 hooks (one per type), framework, levers, CTA, claims, captions per platform, and per format: headline/subhead/badge/photo prompt/layout, 5–8 slides, or video scenes (kind, picture source, voice-over or set length, on-screen line, key words, sticker, stat, review, price, transition) |
| 8 QA Gate 1 | `agents/qa-critic/gate1.ts` | Before any money is spent | Weighted score (§10.1); pass = overall ≥ 7.0, no auto-fail and no open code problems | Scores eight dimensions (0–10), lists auto-fails and one fix per issue with a severity |
| 7 Producer | `agents/producer/` | Makes the asset | Sizes per platform (`canvases.ts`); images and slides drawn by our Satori layouts (`src/creative/`); videos: real moments and photos used as they are, everything copied into `work/`, the video Timeline built by code (`creative/video/timeline.ts`) and drawn by Remotion on the worker; scene descriptions pass through `pictureOnly()` so the image and video models never get asked for words | Kie picture (real product photo as reference) and clips where no real one fits, ElevenLabs voice per voiced scene and music, one vision call for where the subject is in each picture |
| 8 QA Gate 2 | `agents/qa-critic/gate2.ts` | After the asset | Sizes, every text colour pair ≥ 4.5:1, safe zones, caption length, video length, loudness | OpenAI vision for images and carousels (product matches the reference, no stray AI text, on brand); Twelve Labs for video (hook visible in 3 s, scenes match the script, no glitches) and OpenAI vision on the AI stills (no painted-in words) |
| 9 Publisher | `agents/publisher/` | Approved slot → scheduled post | One target per connected account on the slot's platforms, caption per platform (+ CTA link where links work), at the slot time (or 10 min from now), `origin = agent`; each platform gets its best size from the renditions (`publish-post`) | — |

**Days and video.** Planning the current week only uses days from tomorrow (a part week gets its share of the posts; on the last day the client is sent to next week). **Posts already set** for the days being planned are planned around (`planner/existing.ts`): posts the client scheduled by hand (scheduled, publishing, published or partial, with no plan slot) and slots already in a plan (Auto-create; not rejected or failed). For a week, each platform plans its posts per week minus the ones it already has on those days, and those posts count towards the format mix, so 7 videos a week with 2 already scheduled plans 5 more. New posts go to the emptiest days first, spread away from the busier ones (`spreadDays`); a format whose kind (video, image or text) the day already has counts as one more use, so videos spread over the week; a day's later posts go three hours after its earlier ones. Auto-create keeps its chosen counts but spreads its days the same way. While the video renderer isn't connected (`videoReady()`: settings present and `/health` answers), the Planner plans no video slots and leaves video-only platforms out; every video path (`produce-plan-item`, manual `generate-video`, `/api/ads`, `/api/media` create, retry, redo) checks it first, so nothing is spent on a video that can't be put together.

**Redos.** Gate 1 below the bar sends the fixes back to the Creative Director (at most 2 rewrites; a brief that still doesn't pass is made anyway and the post is `needs_review` with the reason, so a post is always made). The brand's disclaimers stay stored (onboarding, Brand) but no post is written, made or judged with them for now; manual ads get the goal "Sell this product" or "Make people want to discover the brand", never a phrase that reads like a product promise. Gate 2 makes again only what failed: a new photo with QA's fix for images and carousels (all text is ours), only the flagged AI scenes for video (voice, real footage, other clips and music are kept), at most twice, then `needs_review` with the reason in `qa_report.reason`.

**Statuses.** Slot: `planned → briefed → producing → ready | needs_review → approved → scheduled → published` (or `rejected`, `failed`). Plan: `planning → producing → review → approved → scheduled` (or `failed`).

**Stop.** While a post is being made, its panel shows Stop (`POST /api/plan-items/[id]/stop`, `stopItem`): the run is cancelled (`plan-item/cancelled`), then the post and its unfinished media are marked failed ("Stopped by you"), so Try again or Skip work as usual; a plan waiting for its posts counts it as settled. Paid calls already started still finish on the vendor's side.

**Approval modes** (`app_settings.autopilot_mode`). `approve_plan`: the client approves the plan (all `ready` slots) or single slots. `approve_each`: single slots. `full`: `plan-auto-approve` sleeps until `approval_due_at` (`approval_timeout_hours` after review starts) and approves the ready slots if the client hasn't; `needs_review` slots never go out without the client. Approving one slot schedules it straight away in every mode.

**Single ads ("Create an ad").** `POST /api/ads` adds one slot to the plan of the week it goes out in (made on the spot with `strategy.adhoc = true` when there is none) and runs the same chain with `oneOff`. The slot gets the style the client picked in the dialog, else their top style for the format. The weekly Planner still plans a week that only holds single ads and keeps them.

**Auto-create (a chosen number of posts, nothing to type).** The "Auto-create" button on This week has a counter for each kind (image ads, carousels, videos; 2 images, 0 carousels and 1 video to start, 1–10 posts in all) and an optional day. `POST /api/plans/batch` takes `{ static, carousel, video, date? }` (the day, "YYYY-MM-DD", must be after today) and sends `plan/requested` with the same `batch`, and the same Planner runs in batch mode: `planSlots` gets `batch.counts` and the days (the next 7 days from tomorrow, or the one chosen day for every post, spaced 90 minutes apart; `batchFormats()` interleaves the kinds so one kind doesn't bunch up; every post goes to the platforms that take its format, the busiest platform getting all of them and the others their share; videos override an images-only mix, and a kind falls back to any style of that kind when none of the client's picks fit; a kind no platform takes stops the run with a plain reason) → the Planner AI chooses offering, persona, desire, awareness level, angle, hook and reason per post as it does for a week (`PLANNER_BATCH_NOTE`) → `saveBatch` puts each post in the plan of the week its slot falls in (a week of single ads is made when there is none; the week's own strategy and status stay, and a single-ads week waiting for the client goes back to producing) → each post is produced as a single ad (`oneOff`, so the client is notified per post and nothing waits for a whole plan). Nothing replaces an existing plan. Failures notify "Prodo couldn't create your posts" with the exact reason. Meant for testing now; whether it stays in production is decided later.

**Client actions on a slot.** Approve, skip (`rejected`, with an optional reason), make again with a note ("make it punchier": the whole chain runs again with the note; `restartItem()` marks the slot failed with a plain message if the agents can't be started), edit captions, schedule again (after connecting a missing account). Every action is saved in `feedback` for the learning loop. Cancelling an agent post in Posts puts its slot back to `approved`.

**Rendering (`src/creative/`, our code).** `theme.ts` turns the brand kit into colour pairs that pass WCAG AA, loads the brand fonts from Google Fonts (cached in storage under `shared/fonts/`, Inter as fallback), picks the logo version per background and follows the client's logo choice. Images: `templates/ads.tsx` has eight layouts (`spotlight`, `editorial`, `poster`, `split`, `frame`, `bold`, `offer`, `quote`) that work at 1:1, 4:5, 9:16 and 16:9 with safe zones; see Image ads below; `templates/carousel.tsx` has the cover, content and CTA slides; `fit.ts` sizes text to its box; `render.tsx` renders with Satori (`next/og`). Videos: `video/timeline.ts` builds the Timeline, `video/preset.ts` picks the look, `video/parts.ts` holds the video safe areas, theme, price and link text; the worker draws it (see Videos). `subtitles.ts` and `providers/ffmpeg/compose-video.ts` (the old ffmpeg video assembly) are only used by the Upload-Post check script.

### Image ads

**Free mode (the default, `IMAGE_AD_MODE`).** The image model makes the WHOLE ad, words included. The Creative Director gets the business, the owner's choices (goals, content style, people, next step), the research (market, beliefs, desires), the product facts, the real reviews and the real product photos, and decides everything else: the concept, the scene, the composition, the colours, the lettering, what the words say and where they sit. There is no template, no layout list, no word limit and no design choices to pick (`prompts/agents/creative-free.ts`, deliberately short: it doesn't tell the AI to add a price, a website or anything else, it decides; the only rules are real facts and a plain logo corner). It writes one full prompt for the image model, with every painted text in double quotes, and a `logoCorner`. Producer (`producer/static-free.ts`) sends that prompt as written, adding only what the system knows (the owner's photo style, no people when the owner chose none, what the reference photo is for, a plain corner for the logo, a note to keep words inside the picture when several sizes are made, QA's notes on a redo), then code adds the brand's logo in that corner (`creative/templates/free.tsx`; the logo is drawn as it is, with no plate, shadow or other styling; the light or dark version is chosen by measuring the corner's brightness, the director is told whether the logo is dark, light or has both so it keeps the corner readable, and nothing is added when the owner chose no logo). The only fixed things are the truth rules (facts from stored data only, prices written as in the fact, never-say words, no urgency without a live offer, real products only, a reference photo's person never copied) and the plain logo corner. Code checks keep the truth ones (prices, never-say, urgency, people, a real product photo as reference); the diagnosis, hook-variety and word-limit checks don't apply. QA Gate 1 and 2 judge it as one made whole: painted words must be spelled correctly, backed by claims and readable, and a model-painted logo is a defect. The designed layouts, `design`, the photo look step and the price badge below only run with `IMAGE_AD_MODE=designed`.

**Direct mode (`IMAGE_AD_MODE=direct`, a test).** No Creative Director, no QA gates and no logo drawn by code. `produce-plan-item` hands the slot to `weekly/produce-direct.ts`: one step gathers the same context the Creative Director would read (`loadCreativeContext`: business, voice, market, brand colours and fonts, the slot, persona, product, offer, reviews, website passages, links, next step) and writes it as plain facts with no instructions (`creative-director/direct-context.ts`); the product's own photos (up to 4; for a brand post or a product with none, 2 of the brand's photos) and the logo are attached as reference images, named in the text ("Image 1: real product photo of…", "Image 2: the brand's logo"); the only request is "Create one ad image for this business's post, based on the details and the attached images below." The research labels the Bible keeps for itself ("(sources: […])") are stripped from the text. **The image model (`IMAGE_AD_ENGINE`): GPT Image 2 on Kie by default (`kie-gpt2`)**: `ai.imageGpt2` creates a `gpt-image-2-image-to-image` job (`input_urls` holds the reference images, up to 16; `gpt-image-2-text-to-image` when there are none), the canvas's own ratio (4:5 only exists at 1K, the others are made at 2K), about $0.03 at 1K and $0.05 at 2K, polled like every Kie job. **`openai`** is OpenAI's own API: `ai.imageFromReferences` calls the images edit endpoint with the text and all the reference images and gets the PNG back in the same call (no polling). `OPENAI_IMAGE_MODEL` (default `chatgpt-image-latest`, the model the ChatGPT app uses; others this account has: `gpt-image-1.5`, `gpt-image-2`) and `OPENAI_IMAGE_QUALITY` (`low`, `medium`, `high` (default), `auto`) choose the model and quality; the size is square, portrait or landscape by the platform's first canvas, and the rest is cropped. `IMAGE_AD_ENGINE=kie` uses Kie's `nano-banana-2` instead. The picture is the final ad, only cropped to each platform's size. The post's brief is made by code (no AI): the angle as its title and hook, a caption per platform (the angle plus the next step and link), the call to action. The Quality tab says "Not checked yet". One paid image call per ad (Kie GPT Image 2 about $0.03–0.05; OpenAI direct about $0.25 at high quality, $0.07 medium, $0.02 low; Kie nano-banana-2 $0.04) plus one embedding. Set it in `.env.local` and restart `npm run dev`.

**Designed mode (`IMAGE_AD_MODE=designed`).**

An image ad is made in this order (carousel covers share steps 4 and 6): Creative Director → code checks → QA Gate 1 → photo → photo look → layout render → QA Gate 2.

- **Style.** The "Create an ad" form and Media → Create can pick any image style the format takes and any video style (`POST /api/ads`, not only the client's onboarding picks; talking to camera and customer videos become voice-over explainers without the client's talking footage); Auto-create and the weekly Planner still use their picks. A **review** ad needs a confirmed review and an **offer** ad a product with a price; without them the form says so before anything is paid for. The ad's objective is "Sell this product" or "Make people want to discover the brand" (never a phrase that reads like a product fact).
- **What a style means** (`IMAGE_BRIEFS` in `core/content/styles.ts`): product photo = the product alone on a simple backdrop; lifestyle = the product in the life it belongs to; in use = a person wearing or using it; offer = the price or deal is the loudest thing; review = the customer's words are the hero; before and after; behind the scenes. Each style also has its own layouts (`IMAGE_STYLE_LAYOUTS`): product → poster, split, frame, editorial; lifestyle → spotlight, editorial, frame, poster; in use → spotlight, editorial, split, frame; offer → offer, bold, split; review → quote, frame; before and after → split, bold; behind the scenes → frame, editorial, spotlight.
- **Variety inside a style.** The Creative Director picks one layout of the style and a `design` ({ align, headlineCase, priceStyle }) and sees the last four image designs; `pickDesign()` never repeats the last layout when another is allowed and never the exact same look. The photo is framed for the layout (`LAYOUT_PHOTO`).
- **Words go where the photo is calm.** After the photo is made, one vision call finds the subject and the calm band, and code measures how light the top and bottom edges are (`producer/photo-look.ts`). The layout puts the words and shade on the calm side, the logo on the other, and crops every size around the subject.
- **No button.** The call to action is words with where to go ("Shop the kimono · royal-gypsy.com", from the CTA link); the caption carries the real link. Only the video end card keeps its button.
- **Prices** are written by code (`priceText`: "₪1,790"), never by the model. The offer layout needs a price or deal and the quote layout a stored review, else the style's next layout is used.
- **Real products, never invented, never copied people.** A product style must use a real product photo as its reference (check in `checkBrief`). A product photo gives the image model the product only: the prompt says any person is a different person and the reference's headwear, jewellery, props and background are left out; only the client's own person and team photos keep their real person (`referenceUse`, `adPhotoPrompt`). Our labels (G1) and colour codes become words before a prompt goes out (`photoWords`).
- **Every printed fact is backed.** QA Gate 1 lists statements on the image that no claim backs ("made on request") and any of them sends the brief back.

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
- **Ad layouts**: Brand → Brand kit → Ad layouts saves `brand_kit.template_ids`; it narrows the layouts of the ad's style (`layoutsFor`) when some of them are picked, and never leaves a style with none (all eight when none are picked).

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
- File storage (R2 bucket `prodo-media`): public read by link; only the server holds the key. The browser can only PUT to a signed link the server made for a key in its own business folder; the server replaces and deletes files.
- Signups are off in Supabase Auth (keep "Allow new users to sign up" off); users are created in the dashboard, and each one gets its own business.

## Error Handling Chain

```
Vendor error → adapter translates to AppError(type, exact message, retryable)
→ job: toInngestError converts to NonRetriableError or RetryAfterError
  (anything else is retried with userMessage(err) as its message)
→ Inngest retries the step or stops the run
→ onFailure writes status + failureMessage(error) to the DB row
→ screen reads the row and shows the message
```

**Every message is exact and readable**: who failed, what they were doing, the status and the vendor's own reason. Examples:

- `OpenAI is out of credit (429 Too Many Requests, credit_balance_exhausted): "You have no credits remaining. Add credits to continue using the API…"`
- `ScrapeCreators (instagram profile, royalgypsy3) couldn't get it: "…"`
- `royal-gypsy.com/old answered 404 Not Found when Firecrawl read it.`
- `Couldn't reach The website (nope.example): the address doesn't exist (DNS lookup found nothing) (ENOTFOUND).`
- `Database error: a column is missing (a migration hasn't been applied) (42703): "column "style" does not exist".`

Where they're made:

| Helper | File | Job |
|---|---|---|
| `request(service, url, init, timeout)` | `providers/http.ts` | Timeouts ("didn't answer within 30 seconds") and network failures with the system code; a wrong address or broken certificate isn't retried |
| `statusError(service, status, detail, retryAfter, what)` / `jsonOrThrow(…, what)` | `providers/http.ts` | HTTP status → type and retry rule, with the status text and the vendor's reason; a 2xx that isn't JSON is an error |
| `vendorDetail(body, text)` | `core/error-text.ts` | The vendor's reason from any reply shape (`error.message`, `message`, `detail`, `errors[]`, S3 XML, an HTML page's title) |
| `cleanReason(text)` | `core/error-text.ts` | Vendor text made safe to show: no keys, tokens, account or project ids; one line, at most 300 characters |
| `userMessage(err)` | `core/errors.ts` | Anything that isn't an `AppError`: database errors (code in words), network codes, zod shapes, code bugs ("Internal error (TypeError): …") |
| `failureMessage(error)` | `jobs/to-inngest-error.ts` | What `onFailure` saves: the step's own message, or Inngest's and the host's failures (time limit, result too big) in words |
| `KNOWN` table + `replyError` / `knownError` | each adapter, `providers/http.ts` | A vendor's documented error codes in plain words, each with its type and whether retrying helps. The message is our sentence, then the status, the code and the vendor's own words |

Each adapter keeps a `KNOWN` table of its vendor's documented error codes, taken from the vendor's own error docs (linked above each table). When a vendor documents a new code, add it there and a case to `scripts/check/error-messages.ts`.

| Service | How it reports errors | Notable cases |
|---|---|---|
| OpenAI | SDK `APIError` with `status`, `code`, `type`; `APIConnectionError` with the network cause | Out of credit (`credit_balance_exhausted`, type `insufficient_quota`), spend limits, daily vs per-minute rate limits, `slow_down`, overloaded (503), unsupported region, model access, organization verification, safety flags, unreadable images. A 200 can still be refused, cut off at the length limit or empty |
| Twelve Labs | `{code, message}`; its message carries the exact limit | Video too short or long, resolution, aspect ratio, size, broken file, link not reachable, plan allowance used up. A 200 with `finish_reason: "length"` is a cut-off answer |
| ElevenLabs | `detail.code` (new) or `detail.status` (old), or a `detail[]` list on 422 | Out of credit, voice not found, plan limits, script too long, too many jobs at once; a rejected music description comes with a suggestion, which the message includes |
| Firecrawl | `{success: false, error, code?}`, sometimes inside a 200; the page's own status in `metadata.statusCode` | Out of credit, site not supported, page too slow, no browser free, all engines failed, DNS or certificate errors; a page that answers 4xx/5xx is an error, not content |
| ScrapeCreators | `{success, error, errorStatus, message}`; older endpoints say "not found" inside a 200 | Not found returns no data (not an error); age-restricted (403 `forbidden`); "IG is blocking us" (500, retried) |
| Kie | Always HTTP 200 with a body `code` and `msg`; failed tasks have `failCode` and `failMsg` | Codes 401, 402, 404, 408, 422, 429, 433, 455, 500, 501, 505; content-policy blocks; failCode 400 isn't retried, 500 is. Failed tasks cost no credits |
| Zernio | `{error, code, details, platformError}` | Disconnected accounts, plan limits, bad fields, rate limits, the platform's own rejection (Meta's `error_user_msg`); a duplicate post is a 409 with no code |
| R2 storage | S3 XML `<Code>` and `<Message>` | Wrong keys or signature, expired link, missing bucket or file, too many writes; a delete that answers 200 still lists the files it couldn't delete |
| Supabase | `{code, message, details, hint}`; a network failure has an empty code | Postgres and PostgREST codes in words (missing migration, duplicate row, row still in use, deadlock, timeouts) |
| Inngest / Vercel | `onFailure` gets `{name, message}` | Vercel's time limit ("HTTP 504 before the SDK responded"), payload too big, step result over 4 MB, Inngest can't reach the server, invoke timeout |

On the research screen, the agent card shows the agent's final message; the activity feed shows each failed step's message, marked "Trying again after" while Inngest has tries left and "Failed" once it gives up.

Error types: `PROVIDER_DOWN` (retryable), `RATE_LIMITED` (retryable with delay), `TIMEOUT` (retryable), `UNKNOWN` (retryable), `OUT_OF_CREDIT` (permanent), `LIMIT_REACHED` (permanent: a daily or usage cap), `NOT_CONFIGURED` (permanent: missing or wrong key, a migration not applied), `BUDGET_REACHED` (permanent), `PAUSED` (permanent), `CONTENT_BLOCKED` (permanent), `ACCOUNT_DISCONNECTED` (permanent), `INVALID_INPUT` (permanent).

**What gets retried.** Inngest retries a failed step (2 more tries for research agents), so only errors that can go away by themselves are retried; the rest stop at once (`NonRetriableError`) because the same call fails the same way every time. `classify(err)` (`core/errors.ts`) decides, for any error:

| Retried | Not retried |
|---|---|
| A busy or overloaded service (5xx, 503), a per-minute rate limit (after the wait it asks for), a timeout, a dropped connection, a DNS hiccup, a database deadlock, serialization clash, too many connections, a query timeout, a vendor reply that wasn't JSON, an AI reply in the wrong shape | No credit, a daily or usage cap, a wrong or missing key, no permission, an unsupported region, a disconnected account, rejected input or content, a wrong address (DNS: not found), a broken certificate, a database rule (duplicate, missing link, bad value), a missing table or column (migration), a bug in our code, our own data in the wrong shape |

**Account-wide errors** (`OUT_OF_CREDIT`, `LIMIT_REACHED`, `NOT_CONFIGURED`, `BUDGET_REACHED`, `PAUSED`; `isAccountWide(err)`) also stop the agent, not just the step (see Research agents → `optional()`).

**The type survives between steps.** Inngest keeps only an error's message once a step has failed for good, so `toInngestError` writes the type at its start: `[[OUT_OF_CREDIT]] OpenAI is out of credit…`. `classify()` reads it back on replay; `userMessage()` and `failureMessage()` take it off, so it's never shown. Every `onFailure` saves `failureMessage(error)`.

OpenAI's "too many requests" (429) has four meanings, told apart by its error code and message (`providers/ai/openai.ts`):

- **Out of credit** (type `insufficient_quota`; code `insufficient_quota`, `credit_balance_exhausted` or `billing_hard_limit_reached`): `OUT_OF_CREDIT`, stops.
- **A per-minute limit**: retried after the wait OpenAI asks for (its `retry-after` headers or "try again in 1m30s"), plus up to 20 s at random so steps that failed together don't retry together and collide again.
- **A daily limit, or a wait over 10 minutes**: stops with "OpenAI's daily limit for this account is used up". Retrying within minutes can't help.
- **A request bigger than the minute's limit** ("Request too large"): stops; the account's limits have to be raised with OpenAI.


Inside jobs, wrap step bodies so errors pass through `toInngestError`, e.g. `step.run("x", () => fn().catch(toInngestError))`.

## Trace logs (development)

Set `TRACE_LOG=1` in `.env.local` and restart `npm run dev`. Every research run then writes `.logs/research/<research id>.jsonl`, and every weekly run (the Planner and each post it makes, Auto-create included) `.logs/research/<plan id>.jsonl` (gitignored; off in production). Prompts and replies are kept whole, request bodies up to 30,000 characters:

- **Vendor calls**: everything through `providers/http.ts` `request()` (Firecrawl, ScrapeCreators, Twelve Labs, Zernio, Kie, ElevenLabs, website CSS): method, URL, request body, status, response, time, ScrapeCreators credits.
- **AI calls**: the OpenAI adapter's chat (full prompt and reply) and embeddings (count only), tokens and estimated cost.
- **Database**: every call of the service-role client (`createAdminClient` gets a tracing `fetch`): table, operation, filter, data sent, rows, result. Reads are marked so reports can hide them.
- **Structure**: run, agent and step start/end with summaries, costs and step results; row counts and the brand kit at the start and end of a run.

Events carry their run, agent, step and attempt through `AsyncLocalStorage` (`src/lib/trace/`). Secrets from environment variables are stripped, long values cut, vectors replaced by a note. Tracing never throws.

`npm run trace` builds an HTML report for the latest run (`.logs/research/<run>.html`); `-- <run id>`, `-- --list`, `-- --follow` (live lines in the terminal), `-- --out <file>` (page without wrapper, for an artifact). The viewer is `scripts/trace/viewer.html`; it can also load a `.jsonl` file directly.

## Checks

There is no unit test suite; these are the tests. Run the ones that cover a change before merging it.

**Offline** (no vendors, no database writes):

| Command | Covers |
|---|---|
| `npm run smoke scripts/check/research-logic.ts` | Agents 1–4: page ranking, chunking, colours, baselines |
| `npm run smoke scripts/check/weekly-logic.ts` | Time zones, Planner slots, content rules (mix, styles, goals, people), brief checks, captions |
| `npm run smoke scripts/check/video-logic.ts` | Video styles and sound, looks, labels → footage and facts, storyline checks, the Timeline (timing, captions, placement, sound) |
| `npm run smoke scripts/check/learning-logic.ts` | Engagement rate, baselines, scores, learnings |
| `npm run smoke scripts/check/error-messages.ts` | Every error message: vendor replies (faked, nothing is sent), network failures, database errors, Inngest and hosting failures |
| `npm run smoke scripts/check/render-samples.tsx <dir>` | Every ad layout, carousel slide and end card as PNGs, to look at |
| `npm run smoke scripts/check/video-timeline.ts <out.json> [preset] [ratio]` | A sample video Timeline with a real business's brand and photos (database read only); render it with `cd worker && node scripts/render-local.ts <out.json> <out.mp4>` or `scripts/stills-local.ts` for frames |

**Real calls**: `npm run smoke scripts/smoke/<name>.ts` makes one small call and prints the result and its estimated cost. Paid: `openai`, `kie`, `elevenlabs`, `firecrawl [url]`, `scrapecreators [instagramHandle]`, `twelvelabs [videoUrl]`, `upload-post-render`. Free: `zernio` (read-only), `r2` (storage round trip), `render-worker` (a short check video on the worker), `render-ad` (a full sample ad on the worker), `ffmpeg-worker`, `agent-step` (writes one `agent_runs` row and checks a $0 budget blocks agents). Never fake a vendor response to make one pass.

Raw vendor error messages never reach the browser. Every `AppError` has a plain, user-facing message.

## Inngest Job Rules

1. Each outside call is its own step — retries only replay the failed step
2. Vendor retries disabled (`maxRetries: 0`) — Inngest is the only retry layer
3. Every fetch has a timeout (60s default, 5min for downloads)
4. Event ID = media/post ID — Inngest deduplicates double-clicks
5. `cancelOn` stops a run when the item is deleted mid-job (matching the item and the business)
6. Concurrency: per business 5 images, 2 videos, 3 plan slots, 1 plan, 1 research, 1 footage watch; 1 run per post
7. `onFailure` writes status + message to the DB row
8. `step.sleep` for polling — no server runs while waiting
9. Large files go to storage first; steps pass only the key (Inngest caps step output size)
10. Every event carries `businessId`; functions open the database with `businessDb(businessId)`
11. Reads that decide what a run does (which videos to watch, which photos to describe) happen inside a step, so a replay sees the same list

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
src/creative/                     → our renderers: brand theme, text fitting, Satori layouts (ads, carousel)
src/creative/video/               → the video Timeline builder, looks, placement and safe areas
src/core/content/                 → the client's content choices as rules (prefs.ts), what each style means (styles.ts), Settings → Content (settings.ts)
src/core/creative/video.ts        → video storylines, the scene library, stickers
src/agents/footage/               → watching the client's own videos
worker/remotion/shared/           → the Timeline contract and the looks, shared with the worker (imported as @video/*)
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
| `/api/onboarding`, `/api/onboarding/[step]`, `/submit`, `/progress`, `/retry` | | Draft, wizard saves (the website step starts the scan), submit, research progress and retry |
| `/api/brand/bible` | GET, PUT | Approved + draft + history + Strategist state; PUT saves edits as a new draft |
| `/api/brand/bible/[id]`, `…/approve`, `/api/brand/bible/regenerate` | GET, POST | One version; approve a draft; new draft with a note |
| `/api/brand/sources?refs=` | GET | The text behind a claim |
| `/api/brand/pending` | GET, POST | Facts found on the website; confirm or reject |
| `/api/brand/resources/[resource]`, `…/[id]` | GET, POST, PATCH, DELETE | Brand Hub lists (archive or delete; PATCH `{active:true}` restores). Adding the client's own video sends `brand/footage-added` |
| `/api/brand/kit` | GET, PUT | Brand kit; saving recomputes readable colour pairs |
| `/api/brand/refresh` | POST | Start "Refresh brand" |
| `/api/settings/profile` | GET, PUT | Business profile and goals (same checks as onboarding) |
| `/api/settings/content` | GET, PUT | Content choices and where customers go |
| `/api/settings/automation` | GET, PUT | `app_settings` + this month's spend |
| `/api/uploads` | POST | A signed link for one browser upload: `{ id, key, url }` |
| `/api/media`, `/api/media/[id]`, `…/retry`, `…/redo`, `…/captions`, `/api/media/reference`, `/api/media/improve-idea` | | Media library and generation (`startGenerating()` marks an item failed if its job can't be started) |
| `/api/posts`, `/api/posts/[id]`, `…/publish`, `…/cancel` | | Posts and publishing |
| `/api/accounts`, `/api/accounts/connect?platform=` | GET | Live accounts; connect link for a platform |
| `/api/plans?week=` (this, next or a date), `/api/plans/request`, `/api/plans/[id]/approve` | GET, POST | A week's plan with its slots; plan a week (again); approve a plan |
| `/api/plan-items/[id]` (GET, PATCH captions), `…/approve`, `…/reject`, `…/regenerate`, `…/schedule` | | One slot and the client's actions on it |
| `/api/ads` | POST | "Create an ad": one slot through the full chain, with an optional style |
| `/api/plans/batch` | POST | "Auto-create": `{ static, carousel, video, date? }`; the Planner chooses and makes those posts |
| `/api/activity?planId=&itemId=` | GET | Agent steps (the activity feed) |
| `/api/notifications`, `/api/notifications/read` | GET, POST | The bell |
| `/api/calendar?from&to`, `/api/calendar/events`, `…/[id]` | GET, POST, DELETE | Calendar data; the client's own key dates |
| `/api/captions/improve`, `/api/elevenlabs/voices` | | Helpers |

## Key Design Decisions

- **Storage keys over URLs** — only `publicUrl()` (`providers/storage/paths.ts`) builds full URLs.
- **Connected accounts fetched live** — no `connected_accounts` table.
- **Captions at post time** — the same media can be reposted, and captions differ by platform.
- **All inputs saved** — `media` stores every generation input, plus `creative_spec`, so "Try again" reruns the same thing.
- **Products and services are offerings** — one table with `kind`, archived instead of deleted. Media points at an offering by id; a free-text "Other" product is kept in `creative_spec.product_name`.
- **Settings apart from brand facts** — `app_settings` holds autopilot, budget and pause, so agents only see brand facts.
- **Old profile API** — `PUT /api/profile` (multipart, fields + logo) remains for the Media screens; Settings uses `/api/settings/profile`.
- **Timing and placement are code** — the video Timeline is built from data (voice timings, picture analysis, facts); models never decide where or when anything appears.
