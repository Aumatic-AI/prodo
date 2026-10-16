# Database Schema

Four tables + one storage bucket. Migrations in `supabase/migrations/`.

## Tables

### `business_profile` (always 1 row)

| Column | Type | Notes |
|---|---|---|
| `id` | smallint, PK | `check (id = 1)` — only one row possible |
| `name` | text | Business name |
| `logo_key` | text, nullable | Storage key (e.g. `logo/1729000000.png`) |
| `website` | text, nullable | |
| `language` | text | Default `en`. Drives captions and voice-over language |
| `about` | text | Free text, max 1,500 chars. Combined with the idea to build every AI prompt |

### `media` (library)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `type` | `image` \| `video` | |
| `source` | `generated` \| `uploaded` | |
| `status` | `generating` \| `ready` \| `failed` | |
| `idea` | text, nullable | The user's prompt, saved exactly as entered |
| `aspect_ratio` | `1:1` \| `4:5` \| `9:16` \| `16:9` | |
| `use_logo` | boolean, nullable | Images only |
| `duration_sec` | integer, nullable | `15` \| `30` \| `45`, videos only |
| `voice_id` | text, nullable | Videos only |
| `storage_key` | text, nullable | Null until ready. Pattern: `images/2026/10/<id>.png` |
| `error` | text, nullable | Plain message from the failed job |
| `created_at` | timestamptz | |

### `posts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `media_id` | uuid, FK → `media` | `on delete restrict` — can't delete media used by a post |
| `status` | `draft` \| `scheduled` \| `publishing` \| `published` \| `partial` \| `failed` | |
| `publish_at` | timestamptz, nullable | Null for immediate posts |
| `created_at` | timestamptz | |

### `post_targets` (one per account per post)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `post_id` | uuid, FK → `posts` | `on delete cascade` |
| `platform` | text | `instagram`, `facebook`, `linkedin`, etc. |
| `account_id` | text | Upload-Post's account ID |
| `account_name` | text | Copied at post time (not a live reference) |
| `caption` | text | Per-platform caption |
| `provider` | text | Default `upload-post` |
| `status` | `pending` \| `sending` \| `published` \| `failed` | |
| `provider_ref` | text, nullable | Upload-Post's job ID |
| `url` | text, nullable | Live link to the published post |
| `error` | text, nullable | Plain error message |
| Unique | `(post_id, platform, account_id)` | |

## Storage Bucket (`media`)

Public bucket, 100MB file limit.

| Key pattern | What |
|---|---|
| `images/YYYY/MM/<media-id>.png` | Generated or uploaded images |
| `videos/YYYY/MM/<media-id>.mp4` | Generated or uploaded videos |
| `logo/<timestamp>.png` | Business logo |

## What's NOT stored

- **Connected accounts** — fetched live from Upload-Post, cached 60s
- **Captions on media** — written per-post because they differ by platform
- **File URLs** — built from storage keys by `supabase-storage.ts`
- **Job progress** — Inngest owns step-level state
