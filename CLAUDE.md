# CLAUDE.md — Prodo

AI-powered social media content creation and publishing platform. One repo, one deploy per client. Not multi-tenant.

## Commands

```bash
npm run dev              # Next.js 15 dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npx tsc --noEmit         # Typecheck — run after every change
```

No test suite yet. Inngest dev server at `http://localhost:8288` (`INNGEST_DEV=1` in `.env.local`).

## Architecture

### Module structure

- `src/app/(app)/<tab>/page.tsx` — thin file, renders the module page
- `src/modules/<module>/pages/` — actual page components
- `src/modules/<module>/components/`, `hooks/` — per-module code
- Nav entries in `src/config/navigation.ts`, routes in `src/config/routes.ts`
- Shared UI in `src/components/ui/` (PascalCase filenames)

### Provider adapter pattern (critical)

All external services go through adapters in `src/providers/`. Never import a vendor SDK from a route or page.

- `providers/publishing/types.ts` — `Publisher` interface
- `providers/publishing/registry.ts` — maps provider name to implementation
- `providers/ai/registry.ts` — maps task type (text/image/video/voice) to provider
- `providers/storage/supabase-storage.ts` — the only file that builds URLs from storage keys

### Storage keys, not URLs

`media.storage_key` stores `images/2026/10/<id>.png`. Only `supabase-storage.ts` knows how to turn that into a URL. Never store or pass full URLs.

### Connected accounts

Fetched live from Upload-Post (cached 60s in TanStack Query). No `connected_accounts` table. `account_name` is copied onto `post_targets` at post creation time for history.

### Error handling chain

Vendor error → adapter translates to `AppError` (type + plain message + retry rule) → job converts via `toInngestError` → Inngest retries or stops → `onFailure` saves message on DB row → screen shows it. Raw vendor errors never reach the browser.

### Inngest jobs

Each outside call is its own step. Retries only replay the failed step. Vendor retries disabled. Event ID = media/post ID (deduplicates). `cancelOn` stops runs when items are deleted. See `docs/technical.md` for the full rule set.

### Kie gotcha

Kie returns HTTP 200 even on failure. Must check the `code` field in the response body, not just `response.ok`. Task states: `success`, `fail` (with `failMsg`).

## Supabase

```bash
npx supabase db push --linked
npx supabase gen types typescript --project-id <PROJECT_ID> --schema public > src/types/database.ts
```

Never append `2>&1` to the types command — stderr noise breaks the generated file.

### Client conventions

- **API routes**: `createClient()` from `@/lib/supabase/server`
- **Client components**: `createClient()` from `@/lib/supabase/browser`
- **Inngest jobs**: `createAdminClient()` from `@/lib/supabase/admin` (service-role, bypasses RLS)

## Styling

Design tokens in `src/styles/globals.css`. Never hardcode colors — use the token utility classes (`bg-primary`, `text-muted`, `border-default`, etc.).

Primary color (`--color-primary: #0078D4`) is for buttons and active tab backgrounds only. Page background is `--color-page` (light gray), cards are `--color-surface` (white) with `shadow-xs` and `border-default`.

Hand-written utility classes in `globals.css` are unlayered and always beat Tailwind's generated utilities. If a Tailwind class visually does nothing, check for a competing unlayered rule first.

## Common Gotchas

- Captions are written at post time, not media creation (they differ by platform and the same media can be reposted)
- `media` table stores all generation inputs (idea, aspect_ratio, use_logo, etc.) so "Try again" works
- Media used by a post cannot be deleted (restrict FK)
- `INNGEST_DEV=1` must be unset in production
- Profile save is one multipart PUT (fields + logo together), not separate calls

## Documentation

- `docs/README.md` — overview and quick start
- `docs/database.md` — every table, column, and relationship
- `docs/technical.md` — provider pattern, error handling, job rules
- `docs/blueprint.html` — detailed feature flows (not for AI context)

Update docs when any feature or schema changes.
