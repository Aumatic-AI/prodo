# Technical Details

## Provider Adapter Pattern

External services are isolated behind interfaces in `src/providers/`. The rest of the app never imports a vendor SDK directly.

### Publishing (`providers/publishing/`)

`Publisher` interface defines: `publishPhoto`, `publishVideo`, `getStatus`, `listAccounts`, `getConnectUrl`. `upload-post.ts` implements it. `registry.ts` maps provider names to implementations.

To swap providers: write a new class implementing `Publisher`, register it. No other file changes.

### AI (`providers/ai/`)

`registry.ts` maps task types to provider names:
- `text` → OpenAI (scripts, captions)
- `image` → Kie
- `video` → Kie
- `voice` → ElevenLabs

Each provider file translates vendor errors into `AppError` with a type, plain message, and retry rule.

### Storage (`providers/storage/`)

`supabase-storage.ts` is the only file that knows how to turn a storage key into a URL. Every other file stores and passes keys, never URLs.

## Error Handling Chain

```
Vendor error → adapter translates to AppError(type, message, retryable)
→ job: toInngestError converts to NonRetriableError or RetryAfterError
→ Inngest retries the step or stops the run
→ onFailure writes status + message to the DB row
→ screen reads the row and shows the message
```

Error types: `PROVIDER_DOWN` (retryable), `RATE_LIMITED` (retryable with delay), `OUT_OF_CREDIT` (permanent), `CONTENT_BLOCKED` (permanent), `ACCOUNT_DISCONNECTED` (permanent), `INVALID_INPUT` (permanent), `TIMEOUT` (retryable), `UNKNOWN` (retryable).

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

## Kie Gotcha

Kie returns HTTP 200 even on failure. Must read `code` field in the response body. Task states: `success`, `fail` (with `failMsg`/`failCode`). Always check the body, not just `response.ok`.

## Module Structure

```
src/app/(app)/<tab>/page.tsx      → thin, renders the module page
src/modules/<module>/pages/       → actual page components
src/modules/<module>/components/  → tab-specific components
src/modules/<module>/hooks/       → data fetching hooks
```

Nav entries in `src/config/navigation.ts`. Routes in `src/config/routes.ts`.

## API Routes

Every route wraps its handler with `apiHandler()` from `src/lib/api-handler.ts`, which catches errors and returns `{ error: { code, message } }`. Browser-side `apiFetch()` from `src/lib/api-client.ts` reads that format and throws `ApiError`.

## Key Design Decisions

- **Storage keys over URLs** — `media.storage_key` stores `images/2026/10/<id>.png`. Only `supabase-storage.ts` builds full URLs.
- **Connected accounts fetched live** — no `connected_accounts` table. Upload-Post is the source of truth, cached 60s.
- **Captions at post time** — the same image can be reposted with different text, and captions differ by platform.
- **All inputs saved** — `media` stores idea, aspect_ratio, use_logo, duration_sec, voice_id so "Try again" reruns with the same prompt.
- **Single profile API** — `PUT /api/profile` is multipart form, handles fields + logo in one request.
