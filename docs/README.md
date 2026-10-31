# Prodo

Autonomous AI ad and content system for many businesses, one login each. Onboarding teaches Prodo a business's brand: agents read its website, visuals, videos, socials and competitors, and write a Brand Bible the client approves. After that, agents plan, produce, publish and learn from posts every week. Clients can still create media and posts by hand.

| Doc | What it covers |
|---|---|
| This file | What Prodo is, setup, services, deployment, working rules |
| [`technical.md`](technical.md) | Every flow and rule: providers, agents, onboarding, research, the weekly loop, videos, storage, multi-tenant, errors, jobs, checks, APIs |
| [`database.md`](database.md) | Every table, column, relationship, on-delete rule and file location |
| [`../worker/README.md`](../worker/README.md) | The video worker (Remotion + ffmpeg) and how to deploy it |
| [`../CLAUDE.md`](../CLAUDE.md) | Rules for AI coding assistants working in this repo |

These docs describe the system as it is. Update them in the same change as the code.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your keys (the comments say where each comes from)
npm run dev                  # http://localhost:3000
npx inngest-cli@latest dev   # background jobs and agents, http://localhost:8288 (INNGEST_DEV=1 in .env.local)
```

### One-time setup

**Supabase** (database and logins)

1. Database → Extensions: turn on `vector` (schema `extensions`). Migration `0011` also creates it if missing.
2. Apply the migrations in `supabase/migrations/` in order: `npx supabase link --project-ref <ref>` then `npx supabase db push --linked` (or paste each file into the SQL Editor).
3. Generate types: `npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts` (PowerShell: pipe to `Out-File -Encoding utf8`).
4. Authentication → Sign In / Providers → Email: turn off "Allow new users to sign up".
5. Authentication → Users → Add user (tick Auto Confirm) for each business owner. Each login gets its own business.

**Cloudflare R2** (files)

1. Create a bucket (ours: `prodo-media`), turn on its public `r2.dev` address (a custom domain before launch: `r2.dev` is rate-limited), and make an API token with Object Read & Write on it.
2. Fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` and `NEXT_PUBLIC_MEDIA_URL` in `.env.local`.
3. `npm run smoke scripts/setup/r2-bucket.ts [https://your-app-address]` sets the bucket's rules: reading from any page, uploads from the app, and auto-delete of in-between (`work/`, 90 days) and temporary (`tmp/`, 7 days) files. Run it again when the app gets a new address.
4. `npm run smoke scripts/setup/sfx.ts` puts the video sound effects in `shared/sfx/`.
5. Check: `npm run smoke scripts/smoke/r2.ts`.

**Video worker** (every video is drawn there): deploy `worker/` on the VPS ([`worker/README.md`](../worker/README.md)), then set `FFMPEG_WORKER_URL` and `FFMPEG_WORKER_SECRET` in `.env.local`. Check with `npm run smoke scripts/smoke/render-ad.ts`. Without it, Prodo plans and makes no videos.

## Stack

- **Next.js 15** (App Router, Turbopack), **Tailwind CSS v4** (tokens in `src/styles/globals.css`), **TanStack Query**, **Zustand**
- **Supabase**: Postgres + pgvector, Auth
- **Cloudflare R2**: every file (photos, logos, finished ads and videos, voices, music, fonts)
- **Inngest**: background jobs, the agents, crons, approval waits
- **Video worker** (`worker/`): Remotion 4 draws every video, ffmpeg levels the sound and does small jobs. Docker + Caddy on a Hostinger VPS
- **Satori** (`next/og`): our renderer for image ads and carousel slides (`src/creative/`)

### Services

| Service | Used for |
|---|---|
| OpenAI | Text, vision and embeddings for every agent |
| Kie | AI pictures (nano-banana) and clips (Seedance) |
| ElevenLabs | Voice-over with word timings, music |
| Twelve Labs | Watching videos: the client's own footage, reference and competitor videos, the finished video's QA |
| Firecrawl | Reading websites |
| ScrapeCreators | Public profiles and posts, Meta and Google ad libraries, Google search |
| Zernio | Publishing, scheduling, connected accounts, post analytics |
| Resend | Notification emails (only logged until `EMAIL_ENABLED=1`) |
| Google Fonts | The brand's fonts as files for our renderers |
| Nager.Date | Public holidays (free) |
| Upload-Post | Legacy: old posts and a fallback for small ffmpeg jobs |

Every vendor sits behind an adapter in `src/providers/`; nothing else names a vendor.

## How it works

One repo, one deploy for every business (multi-tenant). **One login = one business**: each login has its own brand, plans, media, posts, connected accounts (its own Zernio profile), budget and files, and never sees another's. Every table has `business_id`; RLS keeps logged-in users to their own business, and agents and jobs use `businessDb(businessId)`.

1. **Onboarding**: the client gives their website (a background scan reads it), then their content choices, basics, products or services, accounts. Agents 1–4 research the brand; the client approves the Brand Bible.
2. **Weekly loop**: Planner → Creative Director → QA Gate 1 → Producer → QA Gate 2 → client approval (or full autopilot) → Publisher.
3. **Learning loop**: the Performance Analyst reads post results daily and writes learnings weekly; the Planner uses them.

Every agent step is logged with its cost; a monthly budget and a pause switch stop all spending. Details in [`technical.md`](technical.md).

### Tabs

| Tab | What it does |
|---|---|
| **This week** (`/week`, home) | The week's plan on a board, approval inbox ("Needs you"), theme and pillar mix, live agent activity, "Create an ad", "Plan this week"; click a post for its preview, reasons, brief, captions, QA scores and steps |
| **Performance** | Weekly report, KPIs, reach over time, platforms, top posts, what's working (learnings), followers |
| **Activity** | Every agent step across the app, filterable |
| **Costs** | The month's AI spend against the budget, by agent, day, asset and weekly plan |
| **Media** | Create images and videos with AI, or upload your own |
| **Posts** | Create a post from media, pick accounts, write captions, publish or schedule |
| **Calendar** | Month and week views of posts, planned slots and key dates; "Add a date" |
| **Brand** | Brand Bible (versions, approve), offerings, offers, proof, photos and videos, personas, pillars, competitors, brand kit; "Refresh brand" |
| **Settings** | Business profile (incl. goals), Content (images or videos, styles, people, voice and music, logo, where customers go), Automation (autopilot, plan day and time, posts per week, budget, pause, notification email), Connected accounts |
| **Onboarding** | Website → Your content → Basics → products or services → connect → review → live research → Brand Bible approval → This week (the first plan starts on approval) |

## Deployment

One Vercel project + one Supabase project + one Inngest environment + one video worker for all businesses.

- **App (Vercel)**: set every variable from `.env.example` (never `INNGEST_DEV`). Run the R2 bucket script with the app's address so browser uploads are allowed.
- **Worker (VPS)**: see [`worker/README.md`](../worker/README.md). Deploy it whenever `worker/` changes, so it always runs the same code as the app.
- **Database**: new migrations go in `supabase/migrations/` and are applied before the code that needs them.

### Adding a business

1. Supabase → Authentication → Users → **Add user** (email and password, or an invite).
2. The database creates the login's business and its settings rows (notification email = the login's email).
3. The person logs in and goes through onboarding; Prodo researches their brand and they approve their Brand Bible.

Deleting a login keeps its business and data; nobody can open them until the business gets a new owner.

## Working rules

- **Checks before every merge**: `npx tsc --noEmit`, `npx tsc -p worker`, `npm run lint`, the offline checks that cover the change (`npm run smoke scripts/check/<name>.ts`) and `npm run build`. There is no unit test suite; the offline checks are the tests.
- **Vendors only through `src/providers/`**. Code does rule-based work, AI only judgement, a paid vendor only where code can't do the job.
- **Facts only**: every price, number, review or deadline in an ad comes from a stored fact or the client's own answer.
- **Storage keys, never URLs**, built with the helpers in `src/providers/storage/paths.ts`.
- **Every query is limited to one business**: RLS in API routes, `businessDb(businessId)` in agents and jobs.
- **Migrations are never edited** once applied; add a new one and list it in `database.md`.
- **Secrets** stay in `.env.local` and the VPS's `worker/.env` (both git-ignored).
- **Real vendor calls cost money**: test with the offline checks and local renders first; never fake a vendor response to make a check pass; post only to test accounts.
- **Docs change with the code.**
