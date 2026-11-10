"use client";

import { useState, type FormEvent } from "react";
import { Facebook, Instagram, Loader2, Play, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/kit/Modal";
import { TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { EmptyState } from "@/components/kit/EmptyState";
import { Skeleton } from "@/components/kit/Skeleton";
import { VideoPlayer } from "@/components/kit/VideoPlayer";
import { button, focusRing } from "@/components/kit/styles";
import { COUNTRY_OPTIONS, countryName } from "@/config/countries";
import type { LibraryAd } from "@/core/ad-library";
import { useAdLibrarySearch, useAdLibraryStart, type LibrarySearch } from "../../hooks/useAdLibrary";

const COUNTRIES = [{ value: "ALL", label: "All countries" }, ...COUNTRY_OPTIONS];

/** "Running 4 months": an ad kept running for long is one that sells. */
export function runningFor(startedAt?: string): string | null {
  if (!startedAt) return null;
  const days = Math.floor((Date.now() - Date.parse(startedAt)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days < 1) return "Started today";
  if (days < 14) return `Running ${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `Running ${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30);
  return `Running ${months} months`;
}

/** Search the Meta Ad Library for active video ads, watch them, and pick one to copy. */
export function AdLibraryPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (ad: LibraryAd) => void }) {
  const start = useAdLibraryStart(open);
  const [text, setText] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [search, setSearch] = useState<LibrarySearch | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const results = useAdLibrarySearch(search);

  const where = country ?? start.data?.country ?? "ALL";
  const pages = results.data?.pages ?? [];
  // An ad can come back on a later page; it shows once
  const ads = pages.flatMap((p) => p.ads).filter((ad, i, all) => all.findIndex((a) => a.id === ad.id) === i);
  const callsLeft = pages.at(-1)?.callsLeft ?? start.data?.callsLeft;

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (q.length < 2) return;
    setPlaying(null);
    setSearch({ query: q, country: where });
  }

  const toolbar = (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          aria-label="Search the ad library"
          value={text}
          onValueChange={setText}
          placeholder="A brand name, or words in the ads"
          className="min-w-0 flex-1"
        />
        <Select value={where} onValueChange={setCountry} options={COUNTRIES} searchable searchPlaceholder="Find a country" className="sm:w-48" />
        <button type="submit" className={button()} disabled={text.trim().length < 2 || results.isFetching}>
          <Search size={16} /> Search
        </button>
      </form>
      {callsLeft !== undefined && (
        <p className="m-0 text-xs text-ob-muted">{callsLeft} searches left today</p>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ad library"
      description="Video ads running now on Facebook and Instagram. Watch one, then pick it to copy."
      toolbar={toolbar}
      className="w-[min(calc(100vw-32px),1080px)]"
    >
      {!search ? (
        <EmptyState
          icon={Search}
          title="Find a video ad to copy"
          description="Search a brand name or words in the ads."
        />
      ) : results.isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/14]" />
          ))}
        </div>
      ) : results.isError && !ads.length ? (
        <Alert tone="error">{results.error.message}</Alert>
      ) : !ads.length ? (
        <EmptyState icon={SearchX} title="No video ads found" description="Try other words, another country, or All countries." />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-ob-muted">
            {ads.length} video ads for “{search.query}” in {search.country === "ALL" ? "all countries" : countryName(search.country)}
          </p>
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} playing={playing === ad.id} onPlay={() => setPlaying(ad.id)} onPick={() => onPick(ad)} />
            ))}
          </ul>
          {results.isError && <Alert tone="error">{results.error.message}</Alert>}
          {results.hasNextPage && (
            <button type="button" className={cn(button({ variant: "secondary" }), "self-center")} disabled={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
              {results.isFetchingNextPage && <Loader2 size={16} className="animate-spin" />} Show more
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

const PLATFORM_ICONS: Record<string, typeof Facebook> = { facebook: Facebook, instagram: Instagram };

/** One ad: its first frame (plays in place), who runs it, for how long, its words and where it runs. */
function AdCard({ ad, playing, onPlay, onPick }: { ad: LibraryAd; playing: boolean; onPlay: () => void; onPick: () => void }) {
  const running = runningFor(ad.startedAt);
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs">
      <div className="relative aspect-[9/14] w-full bg-ob-dark">
        {playing ? (
          <VideoPlayer src={ad.videoUrl} className="size-full" videoClassName="size-full object-contain" fileName={`ad-${ad.id}`} />
        ) : (
          <button type="button" onClick={onPlay} aria-label={`Play ${ad.brand}'s ad`} className={cn("group absolute inset-0 size-full", focusRing)}>
            {ad.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.previewUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <video src={ad.videoUrl} preload="metadata" muted playsInline className="size-full object-cover" />
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-ob-dark/60 text-ob-on-dark transition-transform group-hover:scale-110">
                <Play size={20} className="translate-x-px" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          {ad.brandImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.brandImage} alt="" loading="lazy" className="size-6 shrink-0 rounded-full border border-ob-line object-cover" />
          )}
          <span className="truncate text-sm font-bold text-ob-ink">{ad.brand || "Unknown brand"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {running && <Badge tone="primary" size="sm">{running}</Badge>}
          {ad.platforms.map((p) => {
            const Icon = PLATFORM_ICONS[p];
            return Icon ? <Icon key={p} size={14} className="text-ob-muted" aria-label={p} /> : null;
          })}
        </div>
        {ad.text && <p className="m-0 line-clamp-2 text-[13px] leading-snug text-ob-ink-soft">{ad.text}</p>}
        <button type="button" className={cn(button({ size: "sm" }), "mt-auto w-full")} onClick={onPick}>
          Use this ad
        </button>
      </div>
    </li>
  );
}
