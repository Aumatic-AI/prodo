# Prodo video worker

Makes videos for Prodo on our own server and saves them straight to Prodo's storage (Cloudflare R2). Two kinds of job:

- **Render** (Remotion): the `ad` composition draws a Timeline that Prodo builds (scenes, transitions, captions, cards, stickers, music and sound effects) and becomes an MP4. This is how every Prodo video is made.
- **ffmpeg**: small video tasks (loudness, trimming, converting, thumbnails).

Prodo sends a job, checks on it, and reads the file by its storage key.

## Folders

| Path | What |
|---|---|
| `src/server.ts` | The web server: routes and request checks |
| `src/jobs.ts` | The waiting line: limits per kind, temp folders, job status |
| `src/render.ts` | Remotion renders |
| `src/ffmpeg.ts` | ffmpeg jobs |
| `src/storage.ts` | Downloads inputs from and uploads results to R2; which links are allowed |
| `src/config.ts` | Settings from `.env` |
| `remotion/shared/` | The contract with Prodo, data only (the app imports it as `@video/*`): `timeline.ts` (the Timeline type) and `presets.ts` (the five looks) |
| `remotion/ad/` | The `ad` composition: `Ad.tsx` (scenes in a TransitionSeries, layers, captions, sound), `Scene.tsx` (clips, stills with camera moves, before/after wipe), `Text.tsx` (kinetic titles, word-by-word captions), `Cards.tsx` (stat counter, review, price burst, offer, step, sticker, closing card), `Finish.tsx` (logo, progress bar, grain, light leaks), `Soundtrack.tsx` (voice, ducked music, sound effects), `transitions.ts`, `layout.ts`, `sample.ts` |
| `remotion/templates/` | `Check.tsx`, the deploy test (`check-9x16`…) |
| `scripts/render-local.ts`, `scripts/stills-local.ts` | Render a Timeline JSON (or the sample) to an MP4 or to PNG frames on your own computer |
| `scripts/build.ts` | Bundles the templates and downloads the headless browser (runs during the Docker build) |

## API

All routes except `/health` need the header `x-worker-secret`.

| Route | What |
|---|---|
| `GET /health` | `{ ok, ffmpeg: { running, queued }, render: { running, queued } }` |
| `POST /render` | Body `{ template, props, outputKey }`: `template: "ad"` with a Timeline as props (any size: length, width and height come from the Timeline), or `"check-9x16"`. Returns `202 { jobId }` |
| `POST /jobs` | ffmpeg. Body `{ inputs, args, outputKey, contentType }`. Returns `202 { jobId }` |
| `GET /jobs/:id` | Either kind: `{ status: queued \| running \| done \| failed, outputKey?, error? }` |

- **Renders:** every link in `props` must be https on our storage's public host (`R2_PUBLIC_URL`) or a host in `ALLOWED_INPUT_HOSTS`, because the browser fetches them. One render at a time by default (`MAX_RENDERS`).
- **ffmpeg:** `inputs` are storage keys in the R2 bucket or allowed https links. `args` is the ffmpeg argument list; `{input0}`…`{inputN}`, `{output}` and `{dir}` (the job's folder) become local paths. No shell is used. Two at a time (`MAX_CONCURRENT`).
- Each job has a 10 minute limit, gets its own temp folder (deleted afterwards), and is forgotten an hour after it finishes.

## How the ad is drawn

Prodo decides everything from data (`src/creative/video/timeline.ts` in the app): scene lengths from the voice, captions from its word timings, text zones from the picture analysis, stickers and prices at the moment their key word is said. The composition only draws:

- **Scenes** play in a `TransitionSeries` with plain-CSS transitions (fade, slide, wipe, flip, clock wipe, iris, and a push cut for "zoom"), so renders don't need a graphics card. Clips use `<Video>` from `@remotion/media` (trimmed, slowed, or holding their last frame to fill a scene); stills get the camera move the Timeline gives.
- **Words**: the hook arrives word by word; key words stand out the preset's way (brand box, drawn underline, colour). Captions show 1–3 words with the spoken one lit. Brand fonts load from storage (`@remotion/fonts`).
- **Cards**: a counting number, a review with stars, the price on a burst (`@remotion/shapes`), the offer, step numbers, emoji stickers (the Noto colour emoji font, with a deterministic wobble from `@remotion/noise`) and the closing card. The logo sits on a light plate when the brand has no version for dark pictures.
- **Finish**: logo in a corner until the closing card, a progress bar for explainers, film grain and warm light leaks for the editorial and playful looks.
- **Sound**: the voice per scene, music that ducks under speech and fades in and out, and sound effects on events (files in storage under `shared/sfx/`). After the render, one ffmpeg pass levels the sound to -14 LUFS (what the platforms play at) and copies the picture as it is.

The five looks (`remotion/shared/presets.ts`): minimal, bold, editorial, playful, corporate.

To try a change: `cd worker && npm install`, then `node scripts/render-local.ts` (the sample) or build a real Timeline in the app with `npm run smoke scripts/check/video-timeline.ts <out.json> [preset]` and render it with `node scripts/render-local.ts <out.json> <out.mp4>`. `npm run studio` opens Remotion Studio. Keep every `@remotion/*` package on the same exact version (now 4.0.539).

Licence: Remotion is free for companies of up to 3 people; above that, automated rendering needs the "Automators" licence ($0.01 per render, $100 a month minimum, remotion.pro/license).

## Adding a template

1. Add a component in `remotion/templates/` with a `type` for its props and default props.
2. Register it in `remotion/Root.tsx`.
3. Preview it on your laptop: `cd worker && npm install && npm run studio`.
4. Commit, push, and update the VPS (below).

## Deploy on a Hostinger VPS

1. VPS with the **Ubuntu 24.04 with Docker** template. KVM 2 (2 vCPU / 8 GB) works; KVM 4 renders faster.
2. Point a domain at the VPS IP (an `A` record, e.g. `render.yourdomain.com`).
3. Open ports 22, 80 and 443.
4. Give the VPS read access to the repo (a GitHub deploy key) and `git clone` it to `/opt/prodo`.
5. `cd /opt/prodo/worker && cp .env.example .env` and fill it in:

   | Setting | Value |
   |---|---|
   | `WORKER_DOMAIN` | The domain from step 2 (Caddy gets its HTTPS certificate) |
   | `WORKER_SECRET` | A long random password (`openssl rand -hex 32`); the same value is `FFMPEG_WORKER_SECRET` in the app |
   | `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | The same as in the app |
   | `R2_PUBLIC_URL` | Exactly the app's `NEXT_PUBLIC_MEDIA_URL`: the worker only opens files from that address |
   | `ALLOWED_INPUT_HOSTS` | Other hosts ffmpeg jobs may read from (Kie's result hosts) |
   | `MAX_CONCURRENT`, `MAX_RENDERS`, `RENDER_CONCURRENCY`, `VIDEO_CACHE_MB`, `JOB_TIMEOUT_MS` | Optional limits (see `.env.example`) |
6. `docker compose up -d --build` (the first build takes a few minutes: it downloads the browser).
7. Check: `curl https://render.yourdomain.com/health` returns `{"ok":true,…}`.

In the app's env set `FFMPEG_WORKER_URL=https://render.yourdomain.com` and `FFMPEG_WORKER_SECRET` to the same secret.

Update after a code change (whenever `worker/` changes, so the worker runs the same code as the app):

```bash
cd /opt/prodo && git pull && cd worker && docker compose up -d --build
```

Do it while no video is rendering (`"render":{"running":0,"queued":0}` on `/health`): a render that is running during the rebuild is lost, and its post fails with "The video renderer lost this job".

## Checks

- `npx tsc -p worker` (from the app folder): typecheck the worker and the shared contract.
- `node scripts/render-local.ts [timeline.json] [out.mp4]`: render the sample or a real Timeline on your own computer (free). Make a real one in the app with `npm run smoke scripts/check/video-timeline.ts <out.json> [preset]`; `scripts/stills-local.ts <dir> <frame…> --props <json>` renders single frames as PNGs.
- After a deploy, from the app folder: `npm run smoke scripts/smoke/render-worker.ts` (a short check video) and `npm run smoke scripts/smoke/render-ad.ts` (a full sample ad). Both are free.
- Every `@remotion/*` package and `remotion` stay on the same exact version.

## Run locally

Needs Node 24+ and ffmpeg on the PATH (the sound-levelling step after each render uses it).

```bash
cd worker
npm install
npm run build
WORKER_SECRET=dev R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... R2_PUBLIC_URL=... npm start
```
