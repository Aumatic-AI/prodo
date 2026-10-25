"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Images } from "lucide-react";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { button, numberBadge } from "@/components/kit/styles";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { AccountPicker, unsupportedReason } from "../components/composer/AccountPicker";
import { CaptionEditor } from "../components/composer/CaptionEditor";
import { MediaPanel } from "../components/composer/MediaPanel";
import { WhenPanel, type WhenOption } from "../components/composer/WhenPanel";
import { PlatformMark } from "../components/PlatformMark";
import { PlatformPreview } from "../components/previews";
import { useCreatePost, useGenerateCaptions, useImproveCaption, usePost, usePostMedia, usePublishDraft } from "../hooks/usePosts";
import { mediaUrls, previewType } from "../lib/media-urls";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
      <div className="flex items-center gap-2.5">
        <span className={numberBadge}>{n}</span>
        <h2 className="m-0 text-[17px] font-bold tracking-tight">{title}</h2>
        {hint && <span className="ml-auto text-[13px] text-ob-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Post composer: media, accounts, captions per platform with a live preview, and when it goes out. */
export function CreatePostPage() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");
  const { data: draft } = usePost(draftId ?? "");
  const mediaId = params.get("media") || draft?.media_id || null;

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const { data: media, isLoading: mediaLoading } = usePostMedia(mediaId);
  const createPost = useCreatePost();
  const publishDraft = usePublishDraft();
  const generate = useGenerateCaptions();
  const improve = useImproveCaption();
  const submit = draftId ? publishDraft : createPost;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [when, setWhen] = useState<WhenOption>("now");
  const [date, setDate] = useState(() => toDay(new Date(Date.now() + 86_400_000)));
  const [time, setTime] = useState("09:00");

  // Fill the form once from the draft being edited
  const seeded = useRef(false);
  useEffect(() => {
    if (!draft || seeded.current) return;
    seeded.current = true;
    setSelected(new Set(draft.post_targets.map((t) => t.account_id)));
    setCaptions(Object.fromEntries(draft.post_targets.map((t) => [t.platform, t.caption])));
    if (draft.publish_at) {
      const at = new Date(draft.publish_at);
      setDate(toDay(at));
      setTime(`${pad(at.getHours())}:${pad(at.getMinutes())}`);
    }
  }, [draft]);

  const picked = useMemo(() => accounts?.filter((a) => selected.has(a.id)) ?? [], [accounts, selected]);
  const platforms = useMemo(() => [...new Set(picked.map((a) => a.platform))], [picked]);
  const current = active && platforms.includes(active) ? active : (platforms[0] ?? null);
  const urls = useMemo(() => mediaUrls(media), [media]);
  const scheduledAt = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    return y && m && d ? new Date(y, m - 1, d, h || 0, min || 0) : null;
  }, [date, time]);
  const missingCaptions = platforms.filter((p) => !(captions[p] ?? "").trim()).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function writeAll() {
    if (!mediaId || !platforms.length) return;
    setCaptionError(null);
    try {
      const result = await generate.mutateAsync({ mediaId, platforms });
      setCaptions((prev) => ({ ...prev, ...result.captions }));
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : "Couldn't write captions. Try again.");
    }
  }

  async function improveOne(platform: string) {
    setImproving(platform);
    setCaptionError(null);
    try {
      const result = await improve.mutateAsync({ platform, caption: captions[platform] ?? "" });
      setCaptions((prev) => ({ ...prev, [platform]: result.caption }));
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : "Couldn't improve the caption. Try again.");
    } finally {
      setImproving(null);
    }
  }

  async function send() {
    if (!mediaId || !picked.length) return;
    const targets = picked.map((a) => ({ platform: a.platform, account_id: a.id, account_name: a.name, caption: captions[a.platform] ?? "", provider: a.provider }));
    const publish_at = when === "schedule" && scheduledAt ? scheduledAt.toISOString() : null;
    try {
      if (draftId) await publishDraft.mutateAsync({ id: draftId, action: when, publish_at, targets });
      else await createPost.mutateAsync({ media_id: mediaId, action: when, publish_at, targets });
      router.push("/posts");
    } catch {
      // The error shows under the button
    }
  }

  const back = (
    <Link href="/posts" className={button({ variant: "secondary", size: "sm" })}>
      <ArrowLeft size={15} /> Posts
    </Link>
  );

  if (!mediaId) {
    return (
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
        <PageHeader title="New post" actions={back} />
        <EmptyState
          icon={Images}
          title="Pick something to post"
          description="Every post starts from your media library: an image, video, carousel or text you made or uploaded."
          action={
            <Link href="/media" className={button()}>
              Open Media
            </Link>
          }
        />
      </div>
    );
  }

  const activeAccount = picked.find((a) => a.platform === current);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <PageHeader
        eyebrow={draftId ? "Draft" : "New post"}
        title={draftId ? "Finish your draft" : "Create a post"}
        description="Pick accounts, write a caption for each platform and choose when it goes out."
        actions={back}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <MediaPanel media={media} urls={urls} loading={mediaLoading} />

          <Step n={1} title="Accounts" hint={picked.length ? `${picked.length} selected` : "Pick at least one"}>
            <AccountPicker accounts={accounts} loading={accountsLoading} error={accountsError} selected={selected} onToggle={toggle} mediaType={media?.type} />
          </Step>

          <Step n={2} title="Captions" hint={platforms.length ? undefined : "Pick an account first"}>
            {current ? (
              <CaptionEditor
                platforms={platforms}
                active={current}
                onActive={setActive}
                captions={captions}
                onChange={(p, text) => setCaptions((prev) => ({ ...prev, [p]: text }))}
                onCopyToAll={(text) => setCaptions((prev) => ({ ...prev, ...Object.fromEntries(platforms.map((p) => [p, text])) }))}
                onGenerate={writeAll}
                generating={generate.isPending}
                onImprove={improveOne}
                improving={improving}
                error={captionError}
              />
            ) : (
              <p className="m-0 rounded-ob-md bg-ob-sunken px-4 py-6 text-center text-sm text-ob-muted">Each platform you pick gets its own caption here.</p>
            )}
          </Step>
        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[17px] font-bold tracking-tight">Preview</h2>
              {platforms.length > 1 && (
                <div className="flex gap-1">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-label={`Preview on ${p}`}
                      onClick={() => setActive(p)}
                      className={cn("rounded-ob transition-opacity", p === current ? "opacity-100" : "opacity-40 hover:opacity-80")}
                    >
                      <PlatformMark platform={p} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-ob-md bg-ob-sunken p-4">
              <PlatformPreview
                platform={current ?? "instagram"}
                account={{ displayName: activeAccount?.name ?? "your_brand", avatarUrl: activeAccount?.avatarUrl }}
                caption={current ? (captions[current] ?? "") : ""}
                mediaUrls={urls}
                mediaType={previewType(media)}
              />
            </div>
            {current && unsupportedReason(current, media?.type) && <p className="m-0 text-xs text-ob-warn">{unsupportedReason(current, media?.type)} on this platform.</p>}
          </section>

          <WhenPanel
            when={when}
            onWhen={setWhen}
            date={date}
            onDate={setDate}
            time={time}
            onTime={setTime}
            scheduledAt={scheduledAt}
            accountCount={picked.length}
            missingCaptions={missingCaptions}
            busy={submit.isPending}
            error={submit.error?.message ?? null}
            onSubmit={send}
          />
        </aside>
      </div>
    </div>
  );
}
