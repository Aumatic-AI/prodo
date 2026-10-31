# Database Schema

28 tables + `businesses` in Supabase Postgres; files are in Cloudflare R2 (see File storage). This file is the current truth for the schema: every migration is listed here and every change explained. Migrations live in `supabase/migrations/` and are applied in order:

| Migration | What |
|---|---|
| `0001`–`0008` | Original v3 schema: `business_profile`, `media`, `posts`, `post_targets`, storage bucket |
| `0009_security.sql` | Drops `allow_all` policies and every `anon` grant; authenticated-only RLS; storage writes for logged-in users only |
| `0010_schema_drift.sql` | Columns the code already used but no migration created (`media.voice_name`, `audio_style`, `character`, `language`, `product`; `business_profile.language`) |
| `0011_agentic_schema.sql` | pgvector, 23 new tables, changes to the 4 existing ones, FKs, indexes, triggers, `match_brand_chunks()`, RLS |
| `0012_migrate_profile_products.sql` | Moves data: `about` → `description`, `products` jsonb → `offerings`, `media.product` → `media.offering_id`; drops the old columns |
| `0013_zernio_default_provider.sql` | `post_targets.provider` defaults to `zernio` |
| `0014_zernio_profile.sql` | `app_settings.zernio_profile_id` (each business's own Zernio profile) |
| `0015_research_agents.sql` | Research agents: `offerings`/`offers` `source_id` + `verified`, `competitors.source`, `learnings` dimension `baseline`, `agent_runs.run_id`, `set_research_state()` |
| `0016_weekly_loop.sql` | Weekly loop and learning loop: `plan_items.status` `ready`, `content_plans.approval_due_at` + `error`, notification email columns, storage types `text/plain` + `font/ttf`, `match_recent_hooks()`, `weekly_reports` |
| `0017_multi_tenant.sql` | One login = one business: `businesses`, `business_id` on every table, settings rows per business, per-business unique rules, foreign keys inside one business, `own_business` RLS, search functions per business, storage folder per business, a business for every login (see Multi-tenant below) |
| `0018_drop_leftover_policies.sql` | Drops every policy on the business tables except `own_business` (and old ones on the media bucket), whatever their names: leftover allow-all policies on `business_profile`, `media`, `posts`, `post_targets` let every login see every business there |
| `0019_onboarding_v2.sql` | Onboarding v2: `business_profile` gets `industry`, `currency`, `primary_cta`, `content_prefs`, `cities` (from `onboarding.cities`); `liked_brands` moves to `competitors` rows with `relation = 'inspiration'` and is dropped; `brand_assets.source_id` and kinds `person`, `reference_image`, `general`; `brand_sources.kind = 'reference'`; `set_scan_state()` and `merge_onboarding()` |
| `0020_research_inputs.sql` | `hook_library.source` allows `reference`; `match_brand_chunks()` and `match_recent_hooks()` search one business's rows exactly (the shared HNSW indexes are dropped: with many businesses they returned too few rows) |
| `0021_content_styles.sql` | `plan_items.style` (the client's content style the Planner gave the slot); `learnings` dimension `style` |
| `0022_video_footage.sql` | `brand_assets.analysis` (jsonb): what the client's own video shows, logged once by Twelve Labs (usable moments with times, shot, people, talking and their words, subject position, text area) |

### Changes to the original schema

Every change after the first agentic schema (0011), and why.

| Change | Why |
|---|---|
| `offerings.source_id`, `offerings.verified`, `offers.source_id`, `offers.verified` | Extracted offerings and offers keep their `source_id` and stay unverified until the client confirms (only `proof_items` had these columns at first) |
| `learnings.dimension` allows `baseline` | The research seeds per-platform baselines into `learnings`; the original check didn't allow it |
| `competitors.source` (`client` \| `discovered`) | Competitors the agent finds are kept apart from the client's own, so wizard saves never delete them |
| `agent_runs.run_id` | Groups the steps of one run (e.g. one onboarding research) for the progress screen and its cost |
| `app_settings.zernio_profile_id` | Each business gets its own Zernio profile, created automatically |
| `set_research_state(path, value)` | Research agents running in parallel update `business_profile.onboarding.research` with one atomic statement each (service role only) |
| `calendar_events.source = 'serp'`, `brand_sources.kind = 'serp'` | Still allowed but unused: SerpAPI was replaced by ScrapeCreators |
| `business_profile.content_prefs`, `industry`, `currency`, `primary_cta`, `cities` (0019) | Onboarding v2's "Your content" step and Basics. `cities` was a text answer inside `onboarding` |
| `competitors.relation` (`competitor` \| `inspiration`) (0019) | "Brands to learn from" holds both; replaces `business_profile.liked_brands` (names only, couldn't be studied) |
| `brand_assets.source_id`, kinds `person`, `reference_image`, `general` (0019) | Product photos found on the website keep their page, like every other found fact; people photos, reference posts and the client's own media |
| `set_scan_state(path, value)`, `merge_onboarding(patch)` (0019) | The website scan (service role) and the client's own saves both write `business_profile.onboarding`; each writes only its own keys, so neither overwrites the other |
| `plan_items.status` allows `ready` (0016) | A post that passed both QA gates and waits for the client. `needs_review` stays for posts QA still failed after two redos |
| `content_plans.approval_due_at`, `content_plans.error` (0016) | When full autopilot approves by itself; the plain reason a plan stopped |
| `notifications.email_status` (`none|pending|sent|skipped|failed`), `email_to`, `email_error`, `emailed_at` (0016) | Every notification can also be emailed. `skipped` while sending is off (`EMAIL_ENABLED` unset) |
| `match_recent_hooks(query_embedding, since, match_count)` (0016) | The Creative Director swaps a hook that is too close (similarity ≥ 0.9) to one used in the last 60 days |
| Storage allows `text/plain` and `font/ttf` (0016) | Caption files and brand fonts. Applies to the old Supabase bucket, no longer used since files moved to R2 |
| `weekly_reports` table (0016) | The Performance Analyst's weekly report: `week_start` (unique), `headline`, `summary`, `next_week` text[], `stats` jsonb. RLS like every table |
| `brand_kit.colors.manual`, `brand_kit.fonts.manual` (jsonb keys) | Set when the client edits colours or fonts; research runs keep them |
| `brand_kit.template_ids` now used | The ad layouts the brand uses (Brand kit); empty = all |
| `calendar_events.source = 'system'` now used | Public holidays added by the monthly refresh |
| `businesses` table, `business_id` on every table (0017) | Multi-tenant: one deploy serves many businesses, one login each (before 0017 each client had its own deploy) |
| Settings tables keyed by `business_id` (0017) | `business_profile`, `app_settings`, `brand_kit`: one row per business instead of the single row with `id = 1` |
| Unique rules per business (0017) | `brand_bible (business_id, version)` and one approved Bible per business; `content_plans` and `weekly_reports (business_id, week_start)`; `learnings (business_id, dimension, value, platform)`; `account_snapshots (business_id, platform, account_id, captured_on)` |
| Foreign keys include `business_id` (0017) | `(col, business_id) → parent (id, business_id)`, same names as before. `RESTRICT` became `NO ACTION` (same error for a normal delete, but a whole business can be deleted in one statement); `SET NULL` clears only the id column |
| `match_brand_chunks(…, p_business_id)`, `match_recent_hooks(…, p_business_id)`, `set_research_state(path, value, p_business_id)` (0017) | Search and write one business. Logged-in callers get their own business without passing it |
| `content_plans.strategy.adhoc` (jsonb key, no migration) | A week made only to hold single ads ("Create an ad"); the weekly Planner still plans it and keeps them |
| `plan_items.style`, `learnings` dimension `style` (0021) | The weekly loop follows the client's content styles, and learns which ones work |
| `brand_assets.analysis` (0022) | The client's own videos are watched for moments the ads can use; null for photos and unwatched videos, `{error}` for a video that couldn't be read |

Never edit an applied migration; add a new one.

## Rules

- **One business per login**: every table has `business_id` (not null, `on delete cascade` from `businesses`). See Multi-tenant below.
- **Settings rows**: `business_profile`, `app_settings`, `brand_kit` have one row per business (primary key `business_id`), created with the business.
- **Archive, don't delete**: `offerings`, `offers`, `personas`, `content_pillars` use `active = false`. `SET NULL` foreign keys are only a safety net.
- **Facts trace to a source**: extracted `offerings`/`offers`/`proof_items` keep a `source_id` (or came from the client) and stay inactive/unverified until the client confirms.
- **Storage keys, never URLs** in every `storage_key` / `logo_key` column.
- **Embeddings**: `vector(1536)` for OpenAI `text-embedding-3-small`; searched exactly within one business (0020; no shared vector index). Changing the model = migration + re-embed.
- **Access**: RLS on every table, one policy `own_business` for the `authenticated` role (`business_id = current_business_id()`). No `anon` privileges. Jobs and agents use the service role through `businessDb(businessId)`, which filters and stamps `business_id` itself.
- `updated_at` is maintained by the `set_updated_at` trigger where the column exists.

## Multi-tenant (0017)

### `businesses` — new
One row per business: `id` uuid PK, `owner_id` → `auth.users` (unique; `on delete set null`, so deleting a login keeps its data), `owns_unfoldered_files` (true for the first business: only it may delete files from before 0017, which have no business folder), `created_at`. Logged-in users can read only their own row.

- `current_business_id()`: the logged-in user's business id (security definer). Column default of every `business_id`, used by every RLS policy.
- Trigger `prodo_create_business` on `auth.users`: every new login gets a business. Trigger `seed_business` on `businesses`: creates its `business_profile`, `app_settings` (notification email = the owner's email) and `brand_kit` rows.
- Trigger `keep_business_id` on every table: a row can never move to another business.
- Trigger `guard_server_columns`: only the server may set `app_settings.zernio_profile_id`, `post_targets.provider_ref` and `post_targets.provider_post_id`; logged-in users may only clear them.
- On a database that already had data, 0017 gave it to the first business (the oldest login). A new project starts empty: every business comes from a login.

## Settings (one row per business)

### `business_profile` — changed
The client's onboarding answers. Every agent reads it first.

| Column | Type | Notes |
|---|---|---|
| `business_id` | uuid PK | The business (0017; was `id`, always 1) |
| `name`, `logo_key`, `website` | text | Kept |
| `description` | text | Replaces `about`. 2–3 lines, max 1,500 chars |
| `business_type` | text | `product` \| `service` — picks the products or services step |
| `language` | text | Default `en`. Copy and voice language |
| `timezone` | text | e.g. `Asia/Kolkata` |
| `countries` | text[] | ISO 3166-1 codes in priority order (first = main market), e.g. `{MT,IT}`. Names via `countryName()` in `src/config/countries.ts` |
| `primary_goal` | text | `awareness` \| `leads` \| `sales` \| `bookings` \| `followers`. Always the first of `content_prefs.goals` |
| `content_prefs` | jsonb | "Your content" answers (0019): `{goals (1–2, in order), mix (images \| mostly-images \| balanced \| mostly-videos), image_styles, video_styles (up to 5 each, in order), people (real \| ai \| none), logo (every \| never)}` |
| `industry` | text | One of the onboarding industries (0019). Health, beauty and finance get extra ad-rule checks |
| `currency` | text | ISO code (0019). Default for every new price |
| `cities` | text[] | Cities served, empty = nationwide (0019) |
| `primary_cta` | text | `shop` \| `whatsapp` \| `book` \| `call` (0019): the one next step on every post; the link is in `cta_links` |
| `social_urls` | jsonb | `{instagram, facebook, …}` |
| `cta_links` | jsonb | `{website, shop, booking, whatsapp, phone, lead_magnet}` |
| `tone` | jsonb | Sliders 0–100: `formal`, `playful`, `bold`, `technical` |
| `compliance` | jsonb | `{avoid_words, forbidden_claims, disclaimers}` — QA hard rule |
| `posting_prefs` | jsonb | `{platforms: posts per week, formats}` |
| `voice_id`, `music_mood` | text | Video defaults |
| `onboarding` | jsonb | Wizard progress and answers with no column: `step` (furthest step), `area`, `areas`, `yearsInBusiness`, `faqs`, `voiceName`, `runId`, `submittedAt`, `scan` (website scan, see technical.md), `research` (brand research progress) |
| `onboarding_status` | text | `not_started` → `collecting` → `analyzing` → `review` → `done` |
| `updated_at` | timestamptz | |

Removed: `about` (→ `description`), `products` (→ `offerings`), `liked_brands` (→ `competitors` with `relation = 'inspiration'`, 0019).

### `app_settings` — new
How the system behaves, kept apart from brand facts so agents never see it in prompts.

| Column | Type | Notes |
|---|---|---|
| `business_id` | uuid PK | The business (0017; was `id`, always 1) |
| `autopilot_mode` | text | `full` \| `approve_plan` (default) \| `approve_each` |
| `paused` | boolean | Kill switch: stops all agent work |
| `plan_weekday`, `plan_time` | smallint (0 = Sunday), time | When the weekly plan runs. Default Sunday 09:00 |
| `approval_timeout_hours` | int | Auto-approve after this, full mode only. Default 24 |
| `monthly_budget_usd` | numeric | Agents stop when this month's `agent_runs.cost_usd` reaches it. Default 50 |
| `notify_email` | text | Plan-ready and failure emails |
| `zernio_profile_id` | text | This business's own Zernio profile. Created on first accounts or connect call (migration 0014), never the account's default |

### `brand_kit` — new
Visual identity as exact values, so code draws on-brand ads.

| Column | Type | Notes |
|---|---|---|
| `business_id` | uuid PK | The business (0017; was `id`, always 1) |
| `colors` | jsonb | `{primary, secondary, accent, bg, text}` |
| `fonts` | jsonb | `{heading, body}` |
| `logo_variants` | jsonb | Storage keys: `{full, mark, light, dark}` |
| `photo_style`, `layout_style` | text | Described by AI vision |
| `template_ids` | text[] | Ad layouts this brand uses |

## Brand knowledge

### `brand_bible` — new
Versioned strategy document. Only one row per business can be `approved` (partial unique index).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `version` | int | Increments on each edit; unique per business |
| `status` | text | `draft` \| `approved` \| `superseded` |
| `content` | jsonb | `positioning, value_prop, tone_guide {summary, traits, examples}, visual_rules, offer_stack [{offeringId, name, role, pitch, pending}], do_dont {do, dont}, never_say, personas, pillars, note`. Every statement is a claim `{text, sources}`; schema in `src/core/brand/bible.ts` |
| `approved_at`, `created_at` | timestamptz | |

### `personas` — new
`id`, `name`, `summary`, `pains`/`desires`/`objections`/`triggers`/`phrases` (text[]), `active`, timestamps. Own table so plan items and learnings point at a persona by id. Written when a Bible version is approved (its personas replace the active ones, old ones archived) and editable in Brand → Personas.

### `content_pillars` — new
`id`, `name`, `description`, `target_share` (0–1), `funnel_stage` (`tofu`\|`mofu`\|`bofu`), `active`, timestamps. Written on Bible approval like personas.

### `offerings` — new
Products and services in one table (replaces `business_profile.products`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kind` | text | `product` \| `service` |
| `name`, `description`, `url` | text | |
| `price`, `currency` | numeric, text | |
| `price_model` | text | `fixed` \| `from` \| `hourly` \| `quote` \| `subscription` |
| `benefits`, `objections` | text[] | |
| `audience` | text | |
| `is_hero`, `priority` | boolean, smallint | Hero items get more slots |
| `attributes` | jsonb | Product: variants, specs. Service: process, turnaround, area |
| `active` | boolean | Archive instead of delete |
| `source_id` | uuid FK → `brand_sources` | Page it was found on (null = entered by the client). Migration 0015 |
| `verified` | boolean | `true` for client rows. Extracted rows start `active = false, verified = false`; confirm sets both true, reject keeps `active = false, verified = true` |

### `offers` — new
`id`, `offering_id` (null = store-wide), `title`, `details`, `code`, `starts_at`, `ends_at`, `active`, `source_id`, `verified` (same rules as `offerings`). Urgency copy is allowed only while an active offer backs it.

### `proof_items` — new
`id`, `offering_id` (null = whole business), `source_id`, `kind` (`review`\|`testimonial`\|`case_study`\|`stat`\|`award`\|`certification`), `content`, `author`, `rating` (0–5), `verified`.

### `brand_assets` — new
`id`, `offering_id`, `source_id` (the website page a found photo came from, 0019), `kind` (`product_photo`\|`team`\|`location`\|`work`\|`reference_video`\|`doc`\|`person`\|`reference_image`\|`general`), `storage_key`, `ai_description` (one line about a photo, or a video's summary), `tags`, `analysis` (0022).

- The client's own: `product_photo`, `team`, `location`, `work`, `person` (people who appear in posts), `general` (other own photos and videos). Ads use them directly or as reference images.
- Other brands' posts the client likes: `reference_image`, `reference_video`. Studied for style and pacing, never used as the client's own.
- `analysis` (own videos only): `{duration, summary, orientation, moments: [{start, end, shows, shot, people, talking, product, quality, use, subject {x, y}, textArea, lines [{start, end, text}]}]}` from one Twelve Labs read; `{error}` when the video couldn't be read; null for photos and videos not watched yet. Partial index `idx_brand_assets_unwatched` finds the unwatched ones.

### `competitors` — new
`id`, `name`, `website`, `social_urls`, `analysis` (`{positioning, angles, offers, formats, hooks, gaps, followers, activeAds}`), `analyzed_at`, `source` (`client` \| `discovered` by the Social & Market Analyst; the wizard only shows and edits `client` rows), `relation` (`competitor` \| `inspiration`, 0019: brands the client admires are studied for style but never treated as rivals).

### `calendar_events` — new
`id`, `date`, `name`, `kind` (`holiday`\|`sale`\|`launch`\|`trend`), `relevance` (1–5), `source` (`system`\|`client`\|`serp`; `serp` is unused since SerpAPI was dropped), `notes`.

## Brand Brain

### `brand_sources` — new
Every raw document read: `id`, `kind` (`web_page`\|`social_post`\|`competitor`\|`serp` (unused)\|`review`\|`upload`\|`reference`: a post link the client pasted in onboarding), `competitor_id`, `url`, `title`, `content_md`, `content_hash` (skip unchanged pages), `metadata`, `fetched_at`.

### `brand_chunks` — new
`id`, `source_id`, `content` (300–800 words), `embedding vector(1536)`, `metadata` (`{offering_id, kind}`, GIN-indexed for filters).

Search with:

```sql
select * from match_brand_chunks(query_embedding, match_count => 8, filter => '{"kind": "web_page"}', p_business_id => '<business id>');
-- p_business_id: needed for the service role (businessDb adds it); logged-in users get their own business
-- returns id, source_id, content, metadata, similarity (1 = identical)
```

## Planning & creative

### `content_plans` — new
`id`, `week_start` (a Monday, unique per business), `brand_bible_id`, `status` (`planning`\|`producing`\|`review`\|`approved`\|`scheduled`\|`done`\|`failed`), `strategy` (`{theme, rationale, mix: [{pillarId, name, target, planned}], events, adhoc}`), `approved_at`, `approval_due_at` (full autopilot, 0016), `error` (0016).

### `plan_items` — new
The core table: one row per slot with every creative decision.

| Column | Type | Notes |
|---|---|---|
| `id`, `plan_id` | uuid | |
| `slot_at` | timestamptz | When it posts |
| `platforms` | text[] | |
| `format` | text | `static` \| `carousel` \| `video` \| `text` |
| `style` | text | The client's image or video style for the slot (`tips`, `showcase`…; `IMAGE_STYLES` / `VIDEO_STYLES` in `core/onboarding/options.ts`), picked by the Planner's code (0021). Null for text posts and older plans |
| `pillar_id`, `persona_id`, `offering_id`, `offer_id` | uuid FKs | |
| `funnel_stage`, `objective` | text | |
| `angle`, `framework`, `hook_type`, `hook_text` | text | Tags the learning loop scores |
| `levers` | text[] | `social_proof`, `scarcity`, `authority`… |
| `is_experiment` | boolean | The 30% exploration |
| `brief` | jsonb | The creative brief (`core/creative/brief.ts`): message, hooks, CTA, claims, captions, and per format the headline and layout, the slides, or the video scenes with their sources, sound and look |
| `captions` | jsonb | `{platform: text}` |
| `rationale` | text | Shown to the client |
| `brief_score`, `qa_score` | numeric | QA Gate 1 and Gate 2 |
| `qa_report` | jsonb | |
| `attempts` | smallint | Regeneration count (max 2) |
| `status` | text | `planned` → `briefed` → `producing` → `ready` (passed both QA gates, 0016) or `needs_review` → `approved` → `scheduled` → `published`; or `rejected` (skipped by the client), `failed`. `qa` is allowed but unused |
| `selected_media_id` | uuid | The asset that passed QA |
| `error` | text | Plain message |

### `hook_library` — new
`id`, `text`, `hook_type`, `platform`, `source` (`generated`\|`own_winner`\|`competitor`\|`reference`, 0020), `plan_item_id`, `score`, `uses`, `embedding vector(1536)` (similarity check against recent hooks).

## Media

### `media` — changed
Every asset, made by an agent or by hand (`plan_item_id` null for manual).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `type` | text | `image` \| `video` \| `text` \| `carousel` |
| `source` | text | `generated` \| `uploaded` |
| `status` | text | `generating` \| `ready` \| `failed` |
| `idea`, `content`, `aspect_ratio`, `use_logo`, `duration_sec`, `voice_id`, `reference_image_key`, `storage_key`, `error`, `created_at` | | Kept |
| `voice_name`, `audio_style`, `character`, `language` | text | Video inputs (were schema drift) |
| `plan_item_id` | uuid | Null for manual media |
| `offering_id` | uuid | Replaces the `product` text column |
| `variant_of` | uuid | Regenerated version of another row |
| `creative_spec` | jsonb | Everything needed to regenerate. Manual "Other" product: `{product_name}` |
| `video_analysis` | jsonb | Twelve Labs result |
| `cost_usd` | numeric | Sum of vendor costs |

### `media_files` — new
`id`, `media_id`, `role` (`slide`\|`rendition`\|`thumbnail`\|`voice`\|`music`\|`subtitles`), `position`, `aspect_ratio`, `storage_key`. A carousel is one `media` row with its slides here.

## Publishing & performance

### `posts` — changed
`id`, `media_id` (restrict), `status` (`draft`\|`scheduled`\|`publishing`\|`published`\|`partial`\|`failed`), `publish_at`, `created_at`, plus `plan_item_id` (unique, null for manual) and `origin` (`manual`\|`agent`).

### `post_targets` — changed
One row per account per post. Kept: `id`, `post_id`, `platform`, `account_id`, `account_name` (copied at post time), `caption`, `provider`, `status` (`pending`\|`sending`\|`published`\|`failed`), `provider_ref`, `url`, `error`; unique `(post_id, platform, account_id)`. New: `provider_post_id` (for metrics), `published_at`. `provider` defaults to `zernio` (0013); older rows keep `upload-post`.

### `post_metrics` — new
One row per target per day for the first 30 days: `post_target_id`, `captured_on` (unique together), `impressions`, `reach`, `views`, `likes`, `comments`, `shares`, `saves`, `clicks`, `followers_gained`, `avg_watch_sec`, `completion_rate`, `engagement_rate`, `raw`.

### `account_snapshots` — new
`platform`, `account_id`, `captured_on` (unique together per business), `followers`, `raw`.

### `learnings` — new
`dimension` (`baseline`\|`angle`\|`hook_type`\|`format`\|`style`\|`framework`\|`lever`\|`pillar`\|`persona`\|`time_slot`), `value` (name, or id as text — no FK on purpose), `platform` (null = all), `sample_size`, `score` (1.0 = baseline), `confidence`, `insight`. Unique on `(business_id, dimension, value, platform)` with nulls not distinct. Baselines: `dimension = baseline`, `value = engagement_rate` or `views`, `score` = the median itself.

### `feedback` — new
`plan_item_id`, `media_id`, `action` (`approve`\|`reject`\|`edit`\|`regenerate`), `note`.

## System

### `agent_runs` — new
One row per agent step: `agent`, `run_id` (groups one workflow run, e.g. one onboarding research), `plan_id`, `plan_item_id`, `media_id`, `inngest_run_id`, `status` (`running`\|`done`\|`failed`), `summary` (shown in the activity feed), `input`, `output`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `duration_ms`, `error`, `created_at`. Powers the activity feed, cost per ad and the monthly budget stop.

### `notifications` — new
`kind` (`plan_ready`, `ad_ready`, `item_needs_review`, `plan_scheduled`, `post_failed`, `agent_stopped`, `budget_reached`), `title`, `body`, `link` (app path), `read_at`, `created_at`, plus `email_status`, `email_to`, `email_error`, `emailed_at` (0016).

## Foreign keys (29)

Every one also includes `business_id` since 0017 (`(col, business_id) → parent (id, business_id)`), so it can only point inside the same business. RESTRICT is now NO ACTION (same error for a normal delete).

| Child column | Parent | On delete |
|---|---|---|
| `offers.offering_id` | `offerings` | CASCADE |
| `offerings.source_id` | `brand_sources` | SET NULL (0015) |
| `offers.source_id` | `brand_sources` | SET NULL (0015) |
| `proof_items.offering_id` | `offerings` | SET NULL |
| `proof_items.source_id` | `brand_sources` | SET NULL |
| `brand_assets.offering_id` | `offerings` | SET NULL |
| `brand_assets.source_id` | `brand_sources` | SET NULL (0019) |
| `brand_sources.competitor_id` | `competitors` | CASCADE |
| `brand_chunks.source_id` | `brand_sources` | CASCADE |
| `content_plans.brand_bible_id` | `brand_bible` | RESTRICT |
| `plan_items.plan_id` | `content_plans` | CASCADE |
| `plan_items.pillar_id` | `content_pillars` | SET NULL |
| `plan_items.persona_id` | `personas` | SET NULL |
| `plan_items.offering_id` | `offerings` | SET NULL |
| `plan_items.offer_id` | `offers` | SET NULL |
| `plan_items.selected_media_id` | `media` | SET NULL |
| `hook_library.plan_item_id` | `plan_items` | SET NULL |
| `media.plan_item_id` | `plan_items` | SET NULL |
| `media.offering_id` | `offerings` | SET NULL |
| `media.variant_of` | `media` | SET NULL |
| `media_files.media_id` | `media` | CASCADE |
| `posts.media_id` | `media` | RESTRICT |
| `posts.plan_item_id` | `plan_items` | SET NULL |
| `post_targets.post_id` | `posts` | CASCADE |
| `post_metrics.post_target_id` | `post_targets` | CASCADE |
| `feedback.plan_item_id` | `plan_items` | CASCADE |
| `feedback.media_id` | `media` | SET NULL |
| `agent_runs.plan_id` | `content_plans` | SET NULL |
| `agent_runs.plan_item_id` | `plan_items` | SET NULL |
| `agent_runs.media_id` | `media` | SET NULL |

## File storage (Cloudflare R2, bucket `prodo-media`)

Files moved from the Supabase `media` bucket to R2 (the bucket and its policies from 0001–0018 are no longer used). Public read by link (Kie, Zernio and Twelve Labs fetch files by URL). Only the server holds the R2 key: the browser uploads through a signed link made for a key in its own `<business id>/` folder; replacing and deleting is done by the server. Upload size limits are in `src/config/uploads.ts`.

| Key | What | Rows |
|---|---|---|
| `<business id>/brand/logo/<id>.png` | The logo | `business_profile.logo_key` |
| `<business id>/brand/logo/<id>-on-light.png`, `-on-dark.png` | Logo versions made by the Visual Identity Analyst | `brand_kit.logo_variants` |
| `<business id>/brand/photos/<asset id>.<ext>` | Products, people, place, work: uploads and photos from the website | `brand_assets` |
| `<business id>/brand/videos/<asset id>.<ext>` | The client's own videos | `brand_assets` |
| `<business id>/brand/references/<id>.<ext>` | Posts and ads the client likes; reference images for "Create an ad" | `brand_assets`, `media.reference_image_key` |
| `<business id>/media/<media id>/9x16.mp4`, `4x5.png`, `slide-01.png`… | Finished files of one media item: main size and renditions, slides. A redo adds `-r<round>` (a new name, so no cached copy of the old file shows) | `media.storage_key`, `media_files` (`rendition`, `slide`) |
| `work/<business id>/<media id>/…` | In-between files: AI pictures and clips (`scene-<n>-r<round>.png/.mp4`), reveal pictures, voice per scene, music. **Deleted by R2 after 90 days** | `media_files` (`thumbnail`, `voice`, `music`) |
| `tmp/…` | Upload-Post working files (`tmp/render-jobs/`) and test files (`tmp/smoke/`). **Deleted by R2 after 7 days** | none |
| `shared/fonts/<family>-<weight>.ttf` | Brand fonts from Google Fonts, kept for our renderers | none |
| `shared/sfx/<name>.wav` | Video sound effects (whoosh, swish, pop, ding, click, shutter, rise), put there by `scripts/setup/sfx.ts` | none |

Files uploaded by the browser are named by the id their row gets (`POST /api/uploads` returns `{ id, key, url }`). Build every key with the helpers in `src/providers/storage/paths.ts`. The auto-delete and CORS rules are set by `npm run smoke scripts/setup/r2-bucket.ts`.

## What's NOT stored

- **Connected accounts** — read live from the publishing provider, cached 60s
- **Captions on media** — written per post (or per plan item), because they differ by platform
- **File URLs** — built from storage keys by `publicUrl()` (`providers/storage/paths.ts`)
- **Job progress** — Inngest owns step state; `agent_runs` holds the human-readable summary and cost
