# CLAUDE.md — Prodo

Autonomous AI ad and content system. Onboarding builds each business's brand knowledge (Brand Bible, Brand Brain); ten agents then plan, produce, publish and learn from posts on a weekly loop. Manual create-and-post still works alongside the agents.

One deploy serves many businesses (multi-tenant): **one login = one business**. A new login gets its own empty business and goes through onboarding. Every table has `business_id`; see "Multi-tenant" below.

## Spec

The plan lives in three claude.ai artifacts. They are the spec; if code and spec disagree, follow the spec and say so.

- **Prodo Agent Blueprint** — https://claude.ai/artifact/FdBQTmEf44xghnbi2hua4a (tools, onboarding fields → columns, the 10 agents, weekly loop, rollout phases)
- **Prodo Data Model** — https://claude.ai/artifact/UdFPf3uWR3RRThUyuy9aH3 (all 27 tables, every FK and its on-delete rule)
- **Prodo Sprint 1 Plan** — https://claude.ai/artifact/M2fkyDrYFMJfb1g5uUMndu (Phase 0 setup, phases 1.1–1.11, standing rules)

Those pages fill their tables from inline JavaScript. Read the raw HTML, not just a summary.

### Status

Sprint 1 and 2 are merged to `main`; multi-tenant work is on branch `multi-tenant`. Don't commit unless the user asks.
- Sprint 1: 1.1–1.10 built. Left for 1.11: FFmpeg worker env vars + smoke test, a full run for both test brands, sprint report, PR.
- Sprint 2 (phases 2–4 of the Blueprint) code written 2026-10-25: Planner (5), Creative Director (6), Producer upgrade (7: Satori ad layouts, carousels, video with captions/music/end card/renditions), QA Critic (8, both gates with targeted redo), Publisher (9, three autopilot modes), weekly cron, This week board + approval inbox, "Create an ad", notifications (in-app + email, sending off). Offline checks pass (`scripts/check/weekly-logic.ts`); no real run yet. **Needs migration 0016** and a worker redeploy.
- UI: every screen uses the kit (`src/components/ui` was deleted). The Dashboard was removed (it was built for Upload-Post); a new one comes with the learning loop.
- Code written 2026-10-25 (round 2): agent 10 Performance Analyst (daily metrics and followers, weekly learnings, hook scores, weekly report), Performance / Activity / Costs screens, logo change → Visual Identity Analyst, client colour and font edits protected, monthly refresh (public holidays + Social & Market Analyst), pause holds scheduled posts, ad layouts per brand, mobile app shell, "make again with a note" in Media. Dropped on purpose: app theme from the client's brand kit.
- Multi-tenant (2026-10-26, branch `multi-tenant`): one login = one business. Needs migrations 0017 and **0018** (drops leftover allow-all policies), then regenerated types. Sprint 1–2 work is merged to `main`.

Migrations were applied by pasting them into the Supabase SQL Editor, not `supabase db push`, so the CLI's history doesn't know them. Before the first `db push`, run `npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015 0016` (add 0017 and 0018 once the user has run them).

**Deviation from the plan:** the plan had one deploy (Supabase, Vercel, Inngest) per client. Prodo is now multi-tenant: one deploy, one login per business, every row tagged with `business_id`.

**Deviation from the plan:** SerpAPI is replaced by ScrapeCreators (no Google Trends or Maps reviews for now). See `docs/technical.md` → Brand research.

**Deviation from the plan:** the Dashboard tab is removed for now; `/week` (This week) is home.

**Deviation from the plan:** email notifications are built (Resend) but only logged until `EMAIL_ENABLED=1`.

**Deviation from the plan:** the FFmpeg worker (`worker/`) runs on a **Hostinger VPS** with Docker + Caddy, not Railway. See `worker/README.md`. Until it's set up, videos render on Upload-Post's FFmpeg API (`providers/ffmpeg/backends/upload-post.ts`); the client switches to the worker by itself once `FFMPEG_WORKER_URL` and `FFMPEG_WORKER_SECRET` are set.

## Commands

```bash
npm run dev              # Next.js 15 dev server (Turbopack)
npm run build            # Production build (to check while `npm run dev` runs: $env:NEXT_DIST_DIR=".next-build"; npm run build)
npm run lint             # ESLint
npx tsc --noEmit         # Typecheck — run after every change
npx tsc -p worker        # Typecheck the FFmpeg worker
npm run trace            # Report of the latest research run (TRACE_LOG=1 in .env.local); -- --follow for live lines
npm run smoke scripts/check/weekly-logic.ts      # Offline checks: Planner slots, brief checks, captions, compose args (also research-logic.ts, learning-logic.ts)
npm run smoke scripts/check/render-samples.tsx <dir>   # Render every ad layout, slide and end card to PNGs to look at
npm run smoke scripts/smoke/openai.ts   # One real call to a vendor (kie, elevenlabs, firecrawl, scrapecreators, twelvelabs, zernio, ffmpeg-worker, agent-step)
```

After every phase: `npx tsc --noEmit`, `npm run lint`, `npm run build` must all pass.

No test suite yet. Inngest dev server at `http://localhost:8288` (`INNGEST_DEV=1` in `.env.local`, never in production).

## Architecture

### Module structure

- `src/app/(app)/<tab>/page.tsx` — thin file, renders the module page
- `src/modules/<module>/pages/` — actual page components
- `src/modules/<module>/components/`, `hooks/` — per-module code
- Nav entries in `src/config/navigation.ts`, routes in `src/config/routes.ts`
- **Design kit: `src/components/kit/`** (the onboarding look, used app-wide): `styles.ts` (`button` cva, `control`, `card`, `row`…), `Field`, `inputs` (TextInput, NumberInput, TextArea), `Select`, `MultiSelect`, `DatePicker`, `TimePicker`, `choices` (Pills, ChoiceCards), `controls` (Switch, Slider, Counter), `TagInput`, `Modal`, `ConfirmDialog`, `Card`, `PageHeader`, `SectionNav`, `SaveBar`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, uploaders (`LogoUploader`, `MediaUploader`, `useUpload`), `PlatformIcon`. New UI uses only the kit.
- Theme: light by default, dark via `<html class="dark">` (`html.dark` in `globals.css` swaps every `ob-*` token). The choice lives in the account menu (bottom of the sidebar), is remembered per browser (`src/lib/theme.ts`) and applied before paint (`theme-script.ts` in the root layout). Use `ob-*` tokens only, so both themes work.
- Sidebar: tabs, then Notifications (page `/notifications`, unread count) and Settings, then the account menu (theme, Settings, Log out). The collapse control is the round button on the sidebar's edge.
- Old `src/components/ui/` is gone. `components/kit/Logo.tsx` holds the logo (`LogoMark`, `Logo`); `components/layout/NavContent.tsx` the shared navigation and account menu.
- `src/modules/week/` is This week (home); `src/modules/calendar/`, `library/` (Media), `posts/` were rebuilt on the kit.
- The app shell (`(app)/layout.tsx`, `components/layout/Sidebar.tsx`) already uses the kit look: `font-ob`, `bg-ob-bg`, `ob-*` tokens.

### State

- **Server data**: TanStack Query (`apiFetch`), as before.
- **Global client state**: Zustand stores created per request through a provider (never a module-level store, so server rendering can't leak data between users). `src/stores/SessionStoreProvider.tsx` holds the user and business summary; read it with `useSession(selector)`.
- Layouts load the session once on the server with `getSession()` (`src/core/session.ts`, cached per request with React `cache`) and pass it to the provider.

### Onboarding gate

`(app)/layout.tsx` redirects to `/onboarding` until `business_profile.onboarding_status = 'done'`. `onboarding/layout.tsx` redirects to `/week` (home) once it is. Both read the cached session, so the check adds no API calls.

### Onboarding module (`src/modules/onboarding/`)

- Steps `basics → business (products or services) → style → connect → review`, then `progress` (live research) and `bible` (review and approve the Brand Bible). Order and helpers in `src/core/onboarding/steps.ts`.
- One zod schema per step in `src/core/onboarding/schemas.ts`, shared by the browser (field errors) and the server (checks). Error paths are keys like `products.0.name`.
- Server: `load.ts` builds the whole draft from the tables; `save-*.ts` save one step each (rows are upserted by client-made UUIDs, removed ones archived or deleted); `save.ts` dispatches; `submit.ts` locks it.
- Client: `store/` (Zustand draft, errors, dirty flags), `hooks/useStepSave` (clean → validate → PUT → merge), `components/form/*` (inputs, pills, choice cards, tags, slider, counter, uploader), `steps/<step>/*`.
- Dropdowns: always the kit `Select` (single, `searchable` for long lists) or `MultiSelect` (searchable, order = priority, numbered pills below). Both are built on Base UI (`@base-ui/react`); never use a native `<select>`. Dates and times: `DatePicker` (popover + react-day-picker, the shadcn pattern) and `TimePicker` (15-minute steps); never `type="date"` or `type="time"`. Floating panels use the `floating`/`popup` styles, which set `font-ob` because portals render outside the page wrapper. Dialogs: `components/Modal` (Base UI Dialog; sticky toolbar and footer, scrolling body). Countries come from `src/config/countries.ts` (all ISO codes, names via `Intl.DisplayNames`).
- Styling: Tailwind classes only, no CSS files. Colours, radii and shadows are `ob-*` theme tokens in `globals.css` (`bg-ob-primary`, `text-ob-muted`, `rounded-ob-lg`, `shadow-ob-xs`). Shared class sets and the `cva` button live in `src/components/kit/styles.ts`. Onboarding's `components/form/Field` wraps the kit `Field` and reads errors from the onboarding store by path. Field errors use `data-invalid` + `group-data-[invalid=true]/field:`.
- Uploads go straight from the browser to storage with a signed link (`POST /api/uploads`); rules in `src/config/uploads.ts`.

### Code vs AI vs vendor

Our own code does anything rule-based (maths, layout, rendering, scheduling, validation). AI only for judgement. A paid vendor only where code can't do the job. All text on ads (headline, CTA, price badge, logo) is drawn by our code (Satori), never by the image model.

### Provider adapter pattern (critical)

All external services go through adapters in `src/providers/`. Never import a vendor SDK from a route, job, page or agent.

- `providers/ai/registry.ts` — the `ai` object: `text`, `vision`, `structured` (zod), `embed`, `image`, `video`, `voice`, `voices`, `music`, `analyzeVideo`, `crawl`, `search`. Jobs, routes and agents call `ai.*`, never a vendor file. Paid calls return `{ data, usage }`
- Models in `src/config/models.ts`, estimated prices in `src/config/pricing.ts`
- `providers/http.ts` — `request()` (timeout) and `statusError()` / `jsonOrThrow()` (status → plain `AppError`). Every adapter uses them
- `providers/publishing/` — `Publisher` interface; `registry.ts` maps provider → implementation. Default `zernio`; `upload-post` stays registered so old rows resolve
- `providers/analytics/` — `Analytics` interface, `zernio.ts` (post metrics, past posts, follower stats)
- `providers/crawl/firecrawl.ts`, `providers/social/scrapecreators.ts` (search, ad libraries, public profiles and posts), `providers/video-understanding/twelvelabs.ts`
- `providers/ffmpeg/` — `client.ts` (worker or Upload-Post backend), `compose-video.ts` builds the ffmpeg argument list (never a shell string)
- `providers/storage/supabase-storage.ts` — the only file that builds URLs from storage keys

### Agents

Each agent is an Inngest function, one step per outside call, and logs every step (summary, tokens, `cost_usd`, duration) to `agent_runs` through `agentStep(step, id, opts, async (track) => …)` in `src/agents/run.ts`; call `track(result.usage)` after each paid call. Before the step runs, `assertBudget` (`src/agents/budget.ts`) stops it with `PAUSED` or `BUDGET_REACHED`.

Layout: one folder per agent (`src/agents/website-analyst/`, `visual-identity/`, `social-market/`). `index.ts` reads top to bottom as the agent's steps (`task(id, work, summary)`); each other file does one job (ranking, merge, colours, baselines…). Shared research code is in `src/agents/research/` (`defineResearchAgent`, context, Brand Brain). Prompts and their zod schemas are in `src/prompts/agents/`. Wrap work the agent can live without in `optional()`.

- **Brand research** (onboarding + "Refresh brand"): 1 Website Analyst, 2 Visual Identity Analyst, 3 Social & Market Analyst (parallel) → 4 Brand Strategist → Brand Bible draft → client approves (`brand/approved`)
- **Weekly loop** (Sprint 2): 5 Planner → 6 Creative Director → 8 QA Gate 1 → 7 Producer → 8 QA Gate 2 → 9 Publisher → 10 Performance Analyst → learnings feed the Planner

All ten agents are built (agent 10, the Performance Analyst, is in `src/agents/performance-analyst/`). The weekly loop lives in `src/agents/planner`, `creative-director`, `qa-critic`, `producer`, `publisher` and `src/agents/weekly` (one slot end to end, cron, review, auto-approve); see `docs/technical.md` → Weekly loop. Our renderer is `src/creative/` (Satori layouts, captions); never let the image model draw text.

### Facts only

Claims, reviews, prices and deadlines must come from stored facts (`offerings`, `offers`, `proof_items`, `brand_chunks`) or the client's own answers. Every extracted fact keeps its `source_id`. Extracted rows stay `active = false` / `verified = false` until the client confirms. Competitor claims are never stored as our facts.

### Storage keys, not URLs

`media.storage_key`, `brand_assets.storage_key`, `media_files.storage_key` store keys like `<business id>/images/2026/10/<id>.png`. A business's files live in its own folder: build keys with `businessKey()` / `storageKeyFor(businessId, …)`. Files from before multi-tenant keep their old paths (no folder). Only `supabase-storage.ts` turns a key into a URL. Never store or pass full URLs. A key that comes from the browser is checked with `assertOwnKey()`; files are deleted only by the server (`removeFiles()`).

### Connected accounts

Read live from the publishing provider (cached 60s in TanStack Query). No `connected_accounts` table. Each business has its own Zernio profile (`app_settings.zernio_profile_id`), so `listAccounts(db)` and `getConnectUrl(db, platform)` take the business's database. Accounts the browser picks for a post are checked with `ownTargets()`. `account_name` is copied onto `post_targets` at post time for history.

### Multi-tenant

One login owns one business (`businesses.owner_id`). Creating a login in Supabase Auth creates its business and settings rows (database triggers); the user then goes through onboarding.

- **API routes**: the logged-in client; RLS (`business_id = current_business_id()`) limits every query, and inserts fill `business_id` by themselves. When the id is needed (events, storage keys) use `currentBusiness()` (`src/core/business.ts`).
- **Agents and jobs**: `businessDb(businessId)` (`src/lib/supabase/business.ts`), the service role limited to one business: it filters every read, update and delete, stamps every insert and passes `p_business_id` to database functions. Never use `createAdminClient()` for tables; it's only for storage and for listing businesses.
- **Events**: every Inngest event carries `businessId` (typed in `src/jobs/client.ts`). Concurrency keys and event ids built from dates include it. Crons send one event per active business (`cronForEveryBusiness`).
- **Settings rows** (`business_profile`, `app_settings`, `brand_kit`) are one row per business: read them with `.single()`, update them with `ownRow(...)`.
- The database backs it up: foreign keys include `business_id`, so a row can't point at another business's row, and a trigger stops a row moving to another business.
- Users can write their own rows straight through the API, so never trust a column the server set: `zernio_profile_id`, `provider_ref` and `provider_post_id` are server-only (trigger), `publish-post` re-checks accounts, and `removeFiles(businessId, keys)` only deletes the business's own files. `cancelOn` matches `businessId` too.

### Error handling chain

Vendor error → adapter translates to `AppError` (type + plain message + retry rule) → job converts via `toInngestError` → Inngest retries or stops → `onFailure` saves message on the DB row → screen shows it. Raw vendor errors never reach the browser.

### Inngest jobs

Each outside call is its own step. Retries only replay the failed step. Vendor retries disabled. Every event carries `businessId`. Event ID = media/post ID (deduplicates); ids built from a week or a time include the business id. `cancelOn` stops runs when items are deleted. Regenerate at most twice, then mark "Needs review". See `docs/technical.md`.

### Kie gotcha

Kie returns HTTP 200 even on failure. Must check the `code` field in the response body, not just `response.ok`. Task states: `success`, `fail` (with `failMsg`).

## Supabase

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --linked
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/database.ts
```

Never append `2>&1` to the types command — stderr noise breaks the generated file. In PowerShell, `>` writes UTF-16, which breaks lint and the build; use `npx supabase gen types typescript --project-id <PROJECT_REF> --schema public | Out-File -Encoding utf8 src/types/database.ts`. Never edit an applied migration; always add a new one.

### Schema rules

- 28 tables plus `businesses`, see `docs/database.md`. Changes after the Data Model artifact (0014–0017) are listed there under "Changes since the Data Model"; that file wins over the artifact. Every table has `business_id`. Settings tables (`business_profile`, `app_settings`, `brand_kit`) have one row per business (primary key `business_id`), made when the business is created.
- Products and services are one table, `offerings`, with `kind`. Type-specific details go in `attributes`.
- Brand rows (`offerings`, `personas`, `content_pillars`, `offers`) are archived with `active = false`, never hard-deleted.
- `brand_bible` is versioned; only one row can be `approved` (partial unique index).
- pgvector: `brand_chunks.embedding` and `hook_library.embedding` are `vector(1536)` (`text-embedding-3-small`). Changing the model means a migration + re-embedding. Search through `match_brand_chunks()`.
- Access: RLS on every table (`own_business`: `authenticated` sees only its own business), no `anon` grants. Agents and jobs use `businessDb(businessId)`.

### Client conventions

- **API routes**: `createClient()` from `@/lib/supabase/server`, or `currentBusiness()` when the business id is needed
- **Client components**: `createClient()` from `@/lib/supabase/browser`
- **Inngest jobs and agents**: `businessDb(businessId)` from `@/lib/supabase/business` (service role, limited to one business)

### Auth

New logins are added in Supabase → Authentication → Users → Add user (there is no sign-up page). Keep "Allow new users to sign up" off in Supabase Auth settings, or anyone could create a business through the Auth API. A login with no business is signed out with a message (`/api/auth/signout`; it never signs out a login that has a business). Logging in or out reloads the page, so no cached data from one business shows for the next login.

`src/middleware.ts` protects every page and every `/api` route. Exceptions: `/login`, `/api/auth/callback`, `/api/inngest` (Inngest signs its own requests). Unauthenticated API calls get `401 { error: { code: "UNAUTHORIZED", message } }`. `apiHandler` checks the user again as a second layer; pass `{ public: true }` only for routes that must work logged out.

## Styling

Design tokens in `src/styles/globals.css`. The whole app uses the `ob-*` tokens (`bg-ob-primary`, `text-ob-muted`, `border-ob-line`, `rounded-ob-lg`, `shadow-ob-xs`) and Plus Jakarta Sans (`font-ob`). Never hardcode colors; platform brand colours come only from `src/config/platforms.ts` (`platformMeta`). The older tokens (`bg-primary`, `text-muted`, `--color-primary: #0078D4`…) are no longer used by any screen.

Page background is `bg-ob-bg`, cards are `bg-ob-surface` with `border-ob-line` and `shadow-ob-xs` (kit `Card`).

Use Tailwind classes directly; don't add CSS files. New tokens go in a `@theme` block in `globals.css`, so they become utilities.

Hand-written utility classes in `globals.css` (`.bg-primary`, `.text-muted`, `.rounded-lg`, `.shadow-sm`…) are unlayered and always beat Tailwind's generated utilities. Don't reuse those names for new styles. If a Tailwind class visually does nothing, check for a competing unlayered rule first. Element resets (`button`, `input`, `a`) are in `@layer base`, so utilities override them.

## Common Gotchas

- Captions are written at post time, not media creation (they differ by platform and the same media can be reposted)
- `media` stores all generation inputs (idea, aspect_ratio, use_logo, offering_id, `creative_spec`, etc.) so "Try again" works
- Media used by a post cannot be deleted (restrict FK)
- A carousel is one `media` row; its slides are `media_files` rows (`role = slide`)
- Settings → Business profile saves through `PUT /api/settings/profile` with the onboarding Basics schema and `saveBasics` (logo uploaded first with a signed link). The old multipart `/api/profile` remains for the Media screens
- Until `business_profile.onboarding_status = 'done'` the app redirects to `/onboarding`. To reopen the wizard for a business on a dev project, set its row back to `not_started`
- `INNGEST_DEV=1` must be unset in production
- Never mock or fake a vendor response to make a check pass. Post only to test social accounts during development

## Documentation

- `docs/README.md` — overview, setup, services
- `docs/database.md` — every table, column, relationship and on-delete rule
- `docs/technical.md` — provider pattern, agents, error handling, job rules
- `docs/blueprint.html` — original v3 feature flows (historical, not for AI context)

Update docs in the same commit whenever a feature, table or rule changes.
