# Prodo FFmpeg worker

Renders videos with ffmpeg and saves the result straight to Supabase storage. The app sends a job, polls it, and reads the file by its storage key.

## API

All routes except `/health` need the header `x-worker-secret`.

| Route | What |
|---|---|
| `GET /health` | `{ ok, running, queued }` |
| `POST /jobs` | Body `{ inputs, args, outputKey, contentType }`. Returns `202 { jobId }` |
| `GET /jobs/:id` | `{ status: queued \| running \| done \| failed, outputKey?, error? }` |

- `inputs`: storage keys in the `media` bucket, or `https` URLs on our Supabase host or a host in `ALLOWED_INPUT_HOSTS`. Anything else is rejected.
- `args`: ffmpeg arguments as a list. `{input0}`…`{inputN}` and `{output}` are replaced with local file paths, and `{dir}` with the job's own folder (burned-in captions use `subtitles={inputN}:fontsdir={dir}` so libass finds the brand font that was downloaded as an input). No shell is used.
- Inputs that aren't media (a `.ass` captions file, a `.ttf` font) are downloaded like any other input and only referenced inside the filter.
- The image includes `fonts-dejavu-core` as a fallback font for captions.
- Two jobs run at a time, each with a 10 minute limit. Temp files are deleted after every job. Finished jobs are forgotten after an hour.

## Deploy on a Hostinger VPS

1. Create a VPS with the **Ubuntu + Docker** template (2 vCPU / 4 GB RAM or more).
2. Point a domain at the VPS IP (an `A` record, e.g. `ffmpeg.yourdomain.com`).
3. Copy this `worker/` folder to the VPS (or `git clone` the repo and `cd worker`).
4. `cp .env.example .env` and fill it in.
5. `docker compose up -d --build`
6. Check: `curl https://ffmpeg.yourdomain.com/health` returns `{"ok":true,…}`.

In the app's env set `FFMPEG_WORKER_URL=https://ffmpeg.yourdomain.com` and `FFMPEG_WORKER_SECRET` to the same secret.

Update after a code change: `git pull && docker compose up -d --build`. **Sprint 2 changed the worker** (`{dir}` and the fallback font), so redeploy it once.

## Run locally

Needs Node 24+ and ffmpeg on the PATH.

```bash
cd worker
WORKER_SECRET=dev SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node src/server.ts
```
