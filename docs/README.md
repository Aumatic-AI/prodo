# Prodo

Autonomous AI ad and content system for one client. Onboarding teaches Prodo the brand: agents read the client's website, visuals, socials and competitors, and write a Brand Bible the client approves. After that, agents plan, produce, publish and learn from posts every week. Clients can still create media and posts by hand.

Specs (claude.ai artifacts): [Agent Blueprint](https://claude.ai/artifact/FdBQTmEf44xghnbi2hua4a) · [Data Model](https://claude.ai/artifact/UdFPf3uWR3RRThUyuy9aH3) · [Sprint 1 Plan](https://claude.ai/artifact/M2fkyDrYFMJfb1g5uUMndu) · [Onboarding Flow](https://claude.ai/artifact/WC3T6r1WKqkMzabU56euX6)

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your keys (see comments in the file)
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --linked
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/database.ts
npm run dev                   # http://localhost:3000
```

Inngest dev server (background jobs): `npx inngest-cli@latest dev` at `http://localhost:8288`, with `INNGEST_DEV=1` in `.env.local`.

### Supabase project setup (once per project)

1. Database → Extensions: turn on `vector` (schema `extensions`). Migration `0011` also creates it if missing.
2. Authentication → Sign In / Providers → Email: turn off "Allow new users to sign up".
3. Authentication → Users → Add user (tick Auto Confirm) for each person who logs in.
4. `npx supabase db push --linked` applies every migration, including RLS, grants and the storage bucket.

## Stack

- **Next.js 15** (App Router, Turbopack)
- **Supabase** (Postgres + pgvector, Storage, Auth)
- **Inngest** (background jobs, agents, weekly cron)
- **Tailwind CSS v4** (design tokens in `src/styles/globals.css`)
- **TanStack Query** (data fetching + cache)
- Vendors through adapters: OpenAI, Kie, ElevenLabs, Zernio, Twelve Labs, Firecrawl, ScrapeCreators, Resend (email, off until `EMAIL_ENABLED=1`), Google Fonts (brand fonts for our renders), Upload-Post (legacy)
- **Satori** (`next/og`): our own renderer for ad layouts, carousel slides and video end cards (`src/creative/`)
- **FFmpeg worker** (`worker/`): our own render service on a Hostinger VPS (Docker + Caddy). See `worker/README.md`

## Architecture

One repo, one deploy per client. Not multi-tenant: each client gets their own Supabase project, Vercel project, Inngest environment and env vars. Same code, separate data.

### Tabs

| Tab | What it does |
|---|---|
| **This week** (`/week`, home) | The week's plan on a board, approval inbox ("Needs you"), the theme and pillar mix, live agent activity, "Create an ad", "Plan this week"; click any post for its preview, reasons, brief, captions, QA scores and steps |
| **Performance** | Results from post metrics: weekly report, KPIs, reach over time, platforms, top posts, what's working (learnings), followers |
| **Activity** | Every agent step across the app, filterable |
| **Costs** | The month's AI spend vs budget, by agent, day, asset and weekly plan |
| **Media** | Create images and videos with AI, or upload your own |
| **Posts** | Create a post from media, pick accounts, write captions, publish or schedule |
| **Calendar** | Month and week views of posts, planned slots and key dates, with the day's agenda, stats, "Up next" and "Add a date" |
| **Brand** | Brand Hub: Brand Bible (versions, approve), offerings, offers, proof, photos and videos, personas, pillars, competitors, brand kit; "Refresh brand" |
| **Settings** | Business profile, automation (autopilot, plan day and time, posts per week, budget, pause, notification email), connected accounts |
| **Onboarding** | Wizard (basics, products or services, style, accounts, review) → live research by agents 1–4 at `/onboarding/progress` → Brand Bible review and approval at `/onboarding/bible` → This week (the first plan starts on approval) |

### Key ideas

- **Provider adapters**: every vendor sits behind `src/providers/`. Swapping one touches only that folder.
- **Agents**: Inngest functions, one step per outside call, every step logged with its cost in `agent_runs`. A monthly budget cap and a pause switch stop all agent spending.
- **Weekly loop**: Planner → Creative Director → QA Gate 1 → Producer → QA Gate 2 → client approval (or full autopilot) → Publisher. See `docs/technical.md` → Weekly loop.
- **Notifications**: in-app bell, plus email through Resend. Emails are built and logged but not sent until `EMAIL_ENABLED=1`.
- **Facts only**: every claim in an ad traces to a stored fact or the client's own answer.
- **Storage keys, not URLs**: only `supabase-storage.ts` builds URLs.
- **Errors**: vendor error → adapter → `AppError` → Inngest retry or stop → plain message on the DB row → screen shows it.

See `docs/technical.md` for the full rules and `docs/database.md` for all 27 tables.

## Deployment

One Vercel project + one Supabase project + one Inngest environment per client. Set all env vars from `.env.example` (never `INNGEST_DEV` in production). Never share an Inngest environment between clients.

```bash
npm run build    # production build
```
