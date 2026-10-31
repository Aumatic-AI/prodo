# CLAUDE.md — Prodo

Autonomous AI ad and content system. Onboarding builds each business's brand knowledge (Brand Bible, Brand Brain); ten agents then plan, produce, publish and learn from posts on a weekly loop. Manual create-and-post still works alongside the agents.

One deploy serves many businesses (multi-tenant): **one login = one business**. A new login gets its own empty business and goes through onboarding. Every table has `business_id`; see "Multi-tenant" below.

## Source of truth

The docs in this repo describe the system as it is. When code and docs disagree, find out which is right, fix the other, and say so.

- `docs/README.md` — what Prodo is, setup, services, deployment, working rules
- `docs/technical.md` — every flow and rule: providers, agents, onboarding, research, the weekly loop, videos, storage, multi-tenant, errors, jobs, checks, APIs
- `docs/database.md` — every table, column, relationship, on-delete rule and file location
- `worker/README.md` — the video worker (Remotion + ffmpeg) on the VPS

Older planning pages (the Blueprint, Data Model and Sprint plans on claude.ai) are out of date. Don't use them.

**Update the docs in the same change** whenever a feature, table, rule, command or setting changes.

## Working rules

- **Commits**: never commit or push unless the user asks in that conversation.
- **Paid calls**: ask before any call that costs money or quota (OpenAI, Kie, ElevenLabs, Twelve Labs, Firecrawl, ScrapeCreators, Zernio posts, Upload-Post). Free without asking: offline checks, local renders, our own worker and storage, database reads.
- **Never fake a vendor response** to make a check pass. Post only to test social accounts during development.
- **Checks after every change**: `npx tsc --noEmit`, `npx tsc -p worker` (when the worker or `worker/remotion/shared` changed), `npm run lint`, the offline checks that cover the change, and `npm run build`. While `npm run dev` runs, build with `$env:NEXT_DIST_DIR=".next-build"; npm run build` (a plain build breaks the running dev server).
- **Secrets** live only in `.env.local` (app) and `worker/.env` (VPS), both git-ignored. Never paste them into code, docs, commits or chat.
- **Code style**: match the surrounding code: its comment density, naming and idiom. Comments say why, in plain words. One file does one job.

## Current state (2026-10-31)

- Built: onboarding v2 (website scan first) → brand research (agents 1–4) → Brand Bible approval → weekly loop (agents 5–9) → learning loop (agent 10). Manual Media, Posts and Calendar screens. Performance, Activity and Costs screens. Settings: Business profile, Content, Automation, Connected accounts.
- Videos: every video is drawn by Remotion on our worker from a Timeline our code builds (storylines per style, scene library, five looks, captions, cards, stickers, transitions, sound effects). The client's own videos are watched for usable moments and used in scenes. See `docs/technical.md` → Videos.
- Files are in Cloudflare R2; the database is Supabase project `focaedtidoocuixiupxn`; migrations 0001–0022 are applied.
- Not yet: a real end-to-end weekly run with paid calls, the publisher tested end to end, the worker update deployed to the VPS, email sending (`EMAIL_ENABLED` off), a custom domain for files (still `r2.dev`).

### Decisions worth knowing

- **Multi-tenant**: one deploy (Vercel + Supabase + Inngest) for every business, one login per business, every row tagged with `business_id`.
- **ScrapeCreators instead of SerpAPI** for search, ad libraries and public social data (no Google Trends or Maps reviews).
- **This week (`/week`) is home**; there is no Dashboard tab.
- **Email** notifications are built (Resend) but only logged until `EMAIL_ENABLED=1`.
- **Files in Cloudflare R2** (bucket `prodo-media`, S3 API signed with `aws4fetch`), not Supabase Storage. Public links come from `NEXT_PUBLIC_MEDIA_URL`. The bucket's CORS and auto-delete rules are set by `npm run smoke scripts/setup/r2-bucket.ts [origin…]`.
- **The video worker** (`worker/`) runs on a Hostinger VPS with Docker + Caddy. Videos need it (`FFMPEG_WORKER_URL`, `FFMPEG_WORKER_SECRET`); Upload-Post's FFmpeg API is only a fallback for small ffmpeg jobs.

## Commands

```bash
npm run dev              # Next.js 15 dev server (Turbopack), http://localhost:3000
npm run build            # Production build (while dev runs: $env:NEXT_DIST_DIR=".next-build"; npm run build)
npm run lint             # ESLint
npx tsc --noEmit         # Typecheck the app
npx tsc -p worker        # Typecheck the video worker
npm run trace            # Report of the latest research run (TRACE_LOG=1 in .env.local); -- --follow for live lines

# Offline checks (no vendors, no database writes)
npm run smoke scripts/check/weekly-logic.ts      # Planner slots, content rules, brief checks, captions
npm run smoke scripts/check/video-logic.ts       # Storylines, video brief checks, looks, the video timeline
npm run smoke scripts/check/research-logic.ts    # Agents 1–4: ranking, chunking, colours, baselines
npm run smoke scripts/check/learning-logic.ts    # Engagement rate, baselines, scores, learnings
npm run smoke scripts/check/render-samples.tsx <dir>                 # Every ad layout, slide and end card as PNGs
npm run smoke scripts/check/video-timeline.ts <out.json> [preset]    # A real brand's sample video Timeline
cd worker && node scripts/render-local.ts <timeline.json> <out.mp4>  # Render it on this computer (free)

# Real calls (paid ones need the user's OK)
npm run smoke scripts/smoke/<name>.ts   # openai, kie, elevenlabs, firecrawl, scrapecreators, twelvelabs, zernio, agent-step
npm run smoke scripts/smoke/r2.ts       # Storage: upload, public link, signed upload, delete (free)
npm run smoke scripts/smoke/render-worker.ts   # A short check video on the deployed worker (free)
npm run smoke scripts/smoke/render-ad.ts       # A full sample ad on the deployed worker (free)

# One-time setup per bucket (free)
npm run smoke scripts/setup/r2-bucket.ts [origin…]   # CORS + auto-delete rules
npm run smoke scripts/setup/sfx.ts                   # Sound effects into shared/sfx/
```

No unit test suite yet; the offline checks above are the tests. Inngest dev server: `npx inngest-cli@latest dev` at `http://localhost:8288` (`INNGEST_DEV=1` in `.env.local`, never in production).

## Architecture

### Module structure

- `src/app/(app)/<tab>/page.tsx` — thin file, renders the module page
- `src/modules/<module>/pages/`, `components/`, `hooks/` — each tab's code (`week` is This week, `library` is Media)
- Nav entries in `src/config/navigation.ts`, routes in `src/config/routes.ts`
- `src/core/` — our rules, no vendor names (profile, media, posts, plans, brand, content choices, creative brief and video storylines)
- `src/agents/` — the ten agents, one folder each; `src/jobs/` — the other Inngest functions
- `src/creative/` — our renderers: Satori ad layouts and slides, and `creative/video/` (the video Timeline builder, looks, placement)
- `src/prompts/agents/` — agent prompts with their zod schemas
- `src/providers/` — the only place a vendor is named
- `worker/` — the video worker; `worker/remotion/shared/` is the contract the app imports as `@video/*`
- **Design kit: `src/components/kit/`**, used app-wide: `styles.ts` (`button` cva, `control`, `card`, `row`…), `Field`, `inputs` (TextInput, NumberInput, TextArea), `Select`, `MultiSelect`, `DatePicker`, `TimePicker`, `choices` (Pills, ChoiceCards, RankedChoiceCards), `controls` (Switch, Slider, Counter), `TagInput`, `Modal`, `ConfirmDialog`, `Card`, `PageHeader`, `SectionNav`, `SaveBar`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, uploaders (`LogoUploader`, `MediaUploader`, `useUpload`), `PlatformIcon`, `Logo`. New UI uses only the kit.
- Theme: light by default, dark via `<html class="dark">` (`html.dark` in `globals.css` swaps every `ob-*` token). The choice lives in the account menu, is remembered per browser (`src/lib/theme.ts`) and applied before paint (`theme-script.ts`). Use `ob-*` tokens only, so both themes work.
- Sidebar: tabs, then Notifications and Settings, then the account menu (theme, Settings, Log out). Shared navigation in `components/layout/NavContent.tsx`.

### State

- **Server data**: TanStack Query (`apiFetch`).
- **Global client state**: Zustand stores created per request through a provider (never a module-level store, so server rendering can't leak data between users). `src/stores/SessionStoreProvider.tsx` holds the user and business summary; read it with `useSession(selector)`.
- Layouts load the session once on the server with `getSession()` (`src/core/session.ts`, cached per request with React `cache`) and pass it to the provider.

### Onboarding gate

`(app)/layout.tsx` redirects to `/onboarding` until `business_profile.onboarding_status = 'done'`. `onboarding/layout.tsx` redirects to `/week` once it is. Both read the cached session, so the check adds no API calls.

### Onboarding module (`src/modules/onboarding/`)

- Steps `website` (start screen; starts the website scan, `src/jobs/onboarding-scan.ts`) `→ content → basics → business (products or services) → connect → review`, then `progress` (live research) and `bible` (review and approve the Brand Bible). Order and helpers in `src/core/onboarding/steps.ts`. Rows the scan found load with `found: true`; saving the step confirms them. See `docs/technical.md` → Onboarding flow.
- One zod schema per step in `src/core/onboarding/schemas.ts`, shared by the browser (field errors) and the server (checks). Error paths are keys like `products.0.name`.
- Server: `load.ts` builds the whole draft from the tables; `save-*.ts` save one step each (rows are upserted by client-made UUIDs, removed ones archived or deleted); `save.ts` dispatches; `submit.ts` locks it. Settings reuse them: `saveProfile` (Business profile) and `core/content/settings.ts` (Content).
- Client: `store/` (Zustand draft, errors, dirty flags), `hooks/useStepSave` (clean → validate → PUT → merge), `components/form/*`, `steps/<step>/*`. `StylePicker` and `VoicePicker` take their values as props, so Settings → Content reuses them.
- Dropdowns: always the kit `Select` (single, `searchable` for long lists) or `MultiSelect` (searchable, order = priority). Both are built on Base UI (`@base-ui/react`); never use a native `<select>`. Dates and times: `DatePicker` and `TimePicker`; never `type="date"` or `type="time"`. Floating panels use the `floating`/`popup` styles, which set `font-ob` because portals render outside the page wrapper. Dialogs: the kit `Modal`. Countries come from `src/config/countries.ts`.
- Uploads go straight from the browser to storage with a signed link (`POST /api/uploads`); rules in `src/config/uploads.ts`.

### Code vs AI vs vendor

Our own code does anything rule-based (maths, layout, rendering, scheduling, validation, timing). AI only for judgement. A paid vendor only where code can't do the job. Every word on an ad or video (headline, CTA, price, captions, logo) is drawn by our code (Satori for images, Remotion for videos), never by the image or video model.

### Provider adapter pattern (critical)

All external services go through adapters in `src/providers/`. Never import a vendor SDK from a route, job, page or agent.

- `providers/ai/registry.ts` — the `ai` object: `text`, `vision`, `structured` (zod), `embed`, `image`, `video`, `voice`, `voices`, `music`, `analyzeVideo`, `crawl`, `search`, `ads`, `social`. Jobs, routes and agents call `ai.*`, never a vendor file. Paid calls return `{ data, usage }`
- Models in `src/config/models.ts`, estimated prices in `src/config/pricing.ts`
- `providers/http.ts` — `request()` (timeout) and `statusError()` / `jsonOrThrow()` (status → plain `AppError`). Every adapter uses them
- `providers/publishing/` — `Publisher` interface; `registry.ts` maps provider → implementation. Default `zernio`; `upload-post` stays registered so old rows resolve
- `providers/analytics/` — `Analytics` interface, `zernio.ts` (post metrics, past posts, follower stats)
- `providers/crawl/firecrawl.ts`, `providers/social/scrapecreators.ts` (search, ad libraries, public profiles and posts), `providers/video-understanding/twelvelabs.ts`
- `providers/ffmpeg/` — `client.ts`: `submitRender` (Remotion on our worker: every video) and `submitJob` (small ffmpeg jobs, worker or Upload-Post); `videoReady()` before anything is spent on a video
- `providers/storage/` — files in **Cloudflare R2**: `r2.ts` (server only: upload, download, delete, signed upload links), `paths.ts` (keys, and `publicUrl()`, the only place a key becomes a URL), `remove-files.ts`

### Agents

Each agent is an Inngest function, one step per outside call, and logs every step (summary, tokens, `cost_usd`, duration) to `agent_runs` through `agentStep(step, id, opts, async (track) => …)` in `src/agents/run.ts`; call `track(result.usage)` after each paid call. Before the step runs, `assertBudget` (`src/agents/budget.ts`) stops it with `PAUSED` or `BUDGET_REACHED`.

Layout: one folder per agent. `index.ts` reads top to bottom as the agent's steps (`task(id, work, summary)`); each other file does one job (ranking, merge, colours, baselines…). Shared research code is in `src/agents/research/` (`defineResearchAgent`, context, Brand Brain). Wrap work the agent can live without in `optional()`.

- **Brand research** (onboarding + "Refresh brand"): 1 Website Analyst, 2 Visual Identity Analyst (also watches the client's own videos), 3 Social & Market Analyst (parallel) → 4 Brand Strategist → Brand Bible draft → client approves (`brand/approved`)
- **Weekly loop**: 5 Planner → 6 Creative Director → 8 QA Gate 1 → 7 Producer → 8 QA Gate 2 → 9 Publisher → 10 Performance Analyst → learnings feed the Planner. One slot end to end is `src/agents/weekly/produce-item.ts`.
- **The client's choices** (goals, content mix, styles, people, logo, next step, music) reach every weekly agent through `contentRules()` in `src/core/content/prefs.ts`; what each style means is in `src/core/content/styles.ts`.

### Videos

The Creative Director fills a **storyline** for the slot's style (`src/core/creative/video.ts`) with scenes from the **scene library**, each with its picture (the client's video moment `[V…]`, their photo `[G…]` or AI). Code picks the sound and the **look** (`src/creative/video/preset.ts`). The Producer makes only the missing pictures, records voices and music, finds where the subject is in each picture, then `buildTimeline()` (`src/creative/video/timeline.ts`) decides every frame, position and sound from data, and the worker draws it (`worker/remotion/ad/`). Never let the renderer or a model decide timing or placement. Full flow in `docs/technical.md` → Videos.

### Facts only

Claims, reviews, prices, numbers and deadlines must come from stored facts (`offerings`, `offers`, `proof_items`, `brand_chunks`) or the client's own answers. Every extracted fact keeps its `source_id`. Extracted rows stay `active = false` / `verified = false` until the client confirms. Competitor and reference content is never stored as our facts.

### Storage keys, not URLs

`media.storage_key`, `brand_assets.storage_key`, `media_files.storage_key` and `business_profile.logo_key` store keys like `<business id>/media/<media id>/9x16.mp4`. Layout: `<business id>/brand/{logo,photos,videos,references}/<id>.<ext>` and `<business id>/media/<media id>/…` are kept; `work/<business id>/<media id>/…` (in-between files: AI stills and clips, voice, music) is deleted by R2 after 90 days, `tmp/` after 7; `shared/fonts/` and `shared/sfx/` are shared. Build keys only with the helpers in `providers/storage/paths.ts` (`brandKey`, `mediaKey`, `workKey`, `tmpKey`, `fontKey`, `sfxKey`); never write a path by hand. Only `publicUrl()` turns a key into a URL; never store or pass full URLs. A key that comes from the browser is checked with `assertOwnKey()`; files are deleted only by the server (`removeFiles()`).

### Connected accounts

Read live from the publishing provider (cached 60s in TanStack Query). No `connected_accounts` table. Each business has its own Zernio profile (`app_settings.zernio_profile_id`), so `listAccounts(db)` and `getConnectUrl(db, platform)` take the business's database. Accounts the browser picks for a post are checked with `ownTargets()`. `account_name` is copied onto `post_targets` at post time for history.

### Multi-tenant

One login owns one business (`businesses.owner_id`). Creating a login in Supabase Auth creates its business and settings rows (database triggers); the user then goes through onboarding.

- **API routes**: the logged-in client; RLS (`business_id = current_business_id()`) limits every query, and inserts fill `business_id` by themselves. When the id is needed (events, storage keys) use `currentBusiness()` (`src/core/business.ts`).
- **Agents and jobs**: `businessDb(businessId)` (`src/lib/supabase/business.ts`), the service role limited to one business: it filters every read, update and delete, stamps every insert and passes `p_business_id` to database functions. Never use `createAdminClient()` for tables; it's only for listing businesses and admin scripts.
- **Events**: every Inngest event carries `businessId` (typed in `src/jobs/client.ts`). Concurrency keys and event ids built from dates include it. Crons send one event per active business (`cronForEveryBusiness`).
- **Settings rows** (`business_profile`, `app_settings`, `brand_kit`) are one row per business: read them with `.single()`, update them with `ownRow(...)`.
- The database backs it up: foreign keys include `business_id`, so a row can't point at another business's row, and a trigger stops a row moving to another business.
- Users can write their own rows straight through the API, so never trust a column the server set: `zernio_profile_id`, `provider_ref` and `provider_post_id` are server-only (trigger), `publish-post` re-checks accounts, and `removeFiles(businessId, keys)` only deletes the business's own files. `cancelOn` matches `businessId` too.

### Error handling chain

Vendor error → adapter translates to `AppError` (type + plain message + retry rule) → job converts via `toInngestError` → Inngest retries or stops → `onFailure` saves the message on the DB row → screen shows it. Raw vendor errors never reach the browser. Starting a job can fail too: `restartItem()` and `startGenerating()` mark the row failed with a plain message instead of leaving it "planned" or "generating".

### Inngest jobs

Each outside call is its own step; retries only replay the failed step. Vendor retries disabled. Reads that decide what a run does go inside a step (replays must see the same answer). Every event carries `businessId`. Event ID = media/post ID (deduplicates); ids built from a week or a time include the business id. `cancelOn` stops runs when items are deleted. Regenerate at most twice, then mark "Needs review". See `docs/technical.md` → Inngest job rules.

### Kie gotcha

Kie returns HTTP 200 even on failure. Check the `code` field in the response body, not just `response.ok`. Task states: `success`, `fail` (with `failMsg`).

## Supabase

```bash
npx supabase link --project-ref focaedtidoocuixiupxn
npx supabase db push --linked
npx supabase gen types typescript --project-id focaedtidoocuixiupxn --schema public > src/types/database.ts
```

Never append `2>&1` to the types command — stderr noise breaks the generated file. In PowerShell, `>` writes UTF-16, which breaks lint and the build; use `npx supabase gen types typescript --project-id focaedtidoocuixiupxn --schema public | Out-File -Encoding utf8 src/types/database.ts`.

**Migrations**: never edit an applied migration; always add a new one, and list it in `docs/database.md`. Migrations 0001–0022 were applied by pasting them into the Supabase SQL Editor, so the CLI's history doesn't know them. Before the first `db push`, run `npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015 0016 0017 0018 0019 0020 0021 0022`.

### Schema rules

- 28 tables plus `businesses`, all in `docs/database.md` (that file is the current truth). Every table has `business_id`. Settings tables (`business_profile`, `app_settings`, `brand_kit`) have one row per business (primary key `business_id`), made when the business is created.
- Products and services are one table, `offerings`, with `kind`. Type-specific details go in `attributes`.
- Brand rows (`offerings`, `personas`, `content_pillars`, `offers`) are archived with `active = false`, never hard-deleted.
- `brand_bible` is versioned; only one row per business can be `approved` (partial unique index).
- pgvector: `brand_chunks.embedding` and `hook_library.embedding` are `vector(1536)` (`text-embedding-3-small`). Changing the model means a migration + re-embedding. Search through `match_brand_chunks()` and `match_recent_hooks()` (exact search within one business).
- Access: RLS on every table (`own_business`: `authenticated` sees only its own business), no `anon` grants. Agents and jobs use `businessDb(businessId)`.

### Client conventions

- **API routes**: `createClient()` from `@/lib/supabase/server`, or `currentBusiness()` when the business id is needed
- **Client components**: `createClient()` from `@/lib/supabase/browser`
- **Inngest jobs and agents**: `businessDb(businessId)` from `@/lib/supabase/business` (service role, limited to one business)

### Auth

New logins are added in Supabase → Authentication → Users → Add user (there is no sign-up page). Keep "Allow new users to sign up" off, or anyone could create a business through the Auth API. A login with no business is signed out with a message (`/api/auth/signout`; it never signs out a login that has a business). Logging in or out reloads the page, so no cached data from one business shows for the next login.

`src/middleware.ts` protects every page and every `/api` route. Exceptions: `/login`, `/api/auth/callback`, `/api/inngest` (Inngest signs its own requests). Unauthenticated API calls get `401 { error: { code: "UNAUTHORIZED", message } }`. `apiHandler` checks the user again as a second layer; pass `{ public: true }` only for routes that must work logged out.

## Styling

Design tokens in `src/styles/globals.css`. The whole app uses the `ob-*` tokens (`bg-ob-primary`, `text-ob-muted`, `border-ob-line`, `rounded-ob-lg`, `shadow-ob-xs`) and Plus Jakarta Sans (`font-ob`). Never hardcode colors; platform brand colours come only from `src/config/platforms.ts` (`platformMeta`).

Page background is `bg-ob-bg`, cards are `bg-ob-surface` with `border-ob-line` and `shadow-ob-xs` (kit `Card`).

Use Tailwind classes directly; don't add CSS files. New tokens go in a `@theme` block in `globals.css`, so they become utilities.

Hand-written utility classes in `globals.css` (`.bg-primary`, `.text-muted`, `.rounded-lg`, `.shadow-sm`…) are unlayered and always beat Tailwind's generated utilities. Don't reuse those names for new styles. If a Tailwind class visually does nothing, check for a competing unlayered rule first. Element resets (`button`, `input`, `a`) are in `@layer base`, so utilities override them.

## Common Gotchas

- Captions are written at post time, not media creation (they differ by platform and the same media can be reposted)
- `media` stores all generation inputs (idea, aspect_ratio, use_logo, offering_id, `creative_spec`, etc.) so "Try again" works
- Media used by a post cannot be deleted (restrict FK)
- A carousel is one `media` row; its slides are `media_files` rows (`role = slide`)
- A redo of a finished file gets a new name (`9x16-r1.mp4`), so no cached copy of the old file shows
- Settings → Business profile saves through `PUT /api/settings/profile`; Settings → Content through `PUT /api/settings/content`. The old multipart `/api/profile` remains for the Media screens
- Until `business_profile.onboarding_status = 'done'` the app redirects to `/onboarding`. To reopen the wizard for a business on a dev project, set its row back to `not_started`
- `INNGEST_DEV=1` must be unset in production
- Video renders need the deployed worker to run the same code as the app: deploy the worker whenever `worker/` changes (see `worker/README.md`)
