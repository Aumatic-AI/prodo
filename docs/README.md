# Prodo

AI-powered social media content creation and publishing platform. Clients create images and videos with AI, write captions, pick accounts, and publish — all from one place.

## Quick Start

```bash
cd prodo
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                   # http://localhost:3000
```

Inngest dev server (background jobs): `npx inngest-cli@latest dev` at `http://localhost:8288`.

## Stack

- **Next.js 15** (App Router, Turbopack)
- **Supabase** (Postgres, Storage, Auth)
- **Inngest** (background jobs — image/video generation, publishing)
- **Tailwind CSS v4** (design tokens in `src/styles/globals.css`)
- **TanStack Query** (data fetching + cache)

## Architecture

One repo, one deploy per client. Not multi-tenant — each client gets their own Supabase project, Vercel project, and env vars. Same code, separate data.

### Five tabs

| Tab | What it does |
|---|---|
| **Media** | Create images (Kie) and videos (OpenAI + Kie + ElevenLabs) with AI, or upload your own |
| **Posts** | Create a post from media, pick accounts, write captions, publish or schedule |
| **Calendar** | Month view of scheduled/published posts |
| **Accounts** | Connected social accounts (live from Upload-Post, cached 60s) |
| **Settings** | Business profile — name, logo, website, language, about |

### Provider Adapter Pattern

All external services go through adapters in `src/providers/`:

- `providers/publishing/` — `Publisher` interface + `upload-post.ts` implementation
- `providers/ai/` — registry mapping tasks (text/image/video/voice) to providers
- `providers/storage/` — Supabase Storage wrapper (storage keys, never raw URLs)

To swap Upload-Post for another service: implement `Publisher`, register it in `registry.ts`. Nothing else changes.

### Background Jobs (Inngest)

Each outside API call is its own step — retries only replay the failed step. See `src/jobs/` and `docs/technical.md` for the full rule set.

### Key Conventions

- Storage keys, not URLs — `media.storage_key` stores `images/2026/10/<id>.png`, only `supabase-storage.ts` builds URLs
- Connected accounts fetched live from Upload-Post (cached 60s), not stored in our DB
- Captions written at post time, not at media creation (they differ by platform)
- All user inputs saved on `media` so "Try again" can rerun with the same prompt
- Errors: vendor error → adapter → `AppError` (type + message + retry rule) → Inngest retry or stop → message on the DB row → screen shows it

## Deployment

One Vercel project + one Supabase project per client. Set all env vars from `.env.example`.

```bash
npm run build    # production build
```
