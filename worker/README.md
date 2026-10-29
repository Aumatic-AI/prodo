# Prodo video worker

Makes videos for Prodo on our own server and saves them straight to Supabase storage. Two kinds of job:

- **Render** (Remotion): a template from `remotion/` filled with data becomes an MP4. This is how videos are made.
- **ffmpeg**: small video tasks (loudness, trimming, converting, thumbnails), and joining clips until the templates replace it.

Prodo sends a job, checks on it, and reads the file by its storage key.

## Folders

| Path | What |
|---|---|
| `src/server.ts` | The web server: routes and request checks |
| `src/jobs.ts` | The waiting line: limits per kind, temp folders, job status |
| `src/render.ts` | Remotion renders |
| `src/ffmpeg.ts` | ffmpeg jobs |
| `src/storage.ts` | Downloads inputs from and uploads results to Supabase storage; which links are allowed |
| `src/config.ts` | Settings from `.env` |
| `remotion/` | The templates: `Root.tsx` registers each one in every size (`sizes.ts`); one file per template in `templates/` |
| `scripts/build.ts` | Bundles the templates and downloads the headless browser (runs during the Docker build) |

## API

All routes except `/health` need the header `x-worker-secret`.

| Route | What |
|---|---|
| `GET /health` | `{ ok, ffmpeg: { running, queued }, render: { running, queued } }` |
| `POST /render` | Body `{ template, props, outputKey }`, e.g. `template: "check-9x16"`. Returns `202 { jobId }` |
| `POST /jobs` | ffmpeg. Body `{ inputs, args, outputKey, contentType }`. Returns `202 { jobId }` |
| `GET /jobs/:id` | Either kind: `{ status: queued \| running \| done \| failed, outputKey?, error? }` |

- **Renders:** every link in `props` must be https on our Supabase host or a host in `ALLOWED_INPUT_HOSTS`, because the browser fetches them. One render at a time by default (`MAX_RENDERS`).
- **ffmpeg:** `inputs` are storage keys in the `media` bucket or allowed https links. `args` is the ffmpeg argument list; `{input0}`…`{inputN}`, `{output}` and `{dir}` (the job's folder) become local paths. No shell is used. Two at a time (`MAX_CONCURRENT`).
- Each job has a 10 minute limit, gets its own temp folder (deleted afterwards), and is forgotten an hour after it finishes.

## Adding a template

1. Add a component in `remotion/templates/` with a `type` for its props and default props.
2. Register it in `remotion/Root.tsx` (it gets an id per size: `<name>-9x16`, `<name>-1x1`, `<name>-4x5`).
3. Preview it on your laptop: `cd worker && npm install && npm run studio`.
4. Commit, push, and update the VPS (below).

## Deploy on a Hostinger VPS

1. VPS with the **Ubuntu 24.04 with Docker** template. KVM 2 (2 vCPU / 8 GB) works; KVM 4 renders faster.
2. Point a domain at the VPS IP (an `A` record, e.g. `render.yourdomain.com`).
3. Open ports 22, 80 and 443.
4. Give the VPS read access to the repo (a GitHub deploy key) and `git clone` it to `/opt/prodo`.
5. `cd /opt/prodo/worker && cp .env.example .env` and fill it in.
6. `docker compose up -d --build` (the first build takes a few minutes: it downloads the browser).
7. Check: `curl https://render.yourdomain.com/health` returns `{"ok":true,…}`.

In the app's env set `FFMPEG_WORKER_URL=https://render.yourdomain.com` and `FFMPEG_WORKER_SECRET` to the same secret.

Update after a code change:

```bash
cd /opt/prodo && git pull && cd worker && docker compose up -d --build
```

## Run locally

Needs Node 24+ and ffmpeg on the PATH.

```bash
cd worker
npm install
npm run build
WORKER_SECRET=dev SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start
```
