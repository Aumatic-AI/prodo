"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SearchX } from "lucide-react";
import type { Voice } from "@/providers/ai/registry";
import { Modal } from "@/components/kit/Modal";
import { Alert } from "../../../components/blocks";
import { button } from "@/components/kit/styles";
import { useVoiceSearch, type VoiceFilterState } from "../../../hooks/useVoiceSearch";
import { useAudioPreview } from "../../../hooks/useAudioPreview";
import { VoiceFilterPanel, VoiceSearchBar } from "./VoiceFilters";
import { VoiceCard } from "./VoiceCard";

interface VoiceBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filters to start from (the same ones the inline suggestions use, so page one is cached) */
  initialFilters: VoiceFilterState;
  selectedId: string | null;
  onPick: (voice: Voice) => void;
}

const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3";

/** ElevenLabs voice library: filters on the side, a list that loads more as you scroll. */
export function VoiceBrowser({ open, onOpenChange, initialFilters, selectedId, onPick }: VoiceBrowserProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [picked, setPicked] = useState<Voice | null>(null);
  const preview = useAudioPreview();
  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useVoiceSearch(filters, open);

  const voices = data?.pages.flatMap((p) => p.voices) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const activeId = picked?.voice_id ?? selectedId;

  // Load the next page when the bottom of the list comes into view
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, voices.length]);

  function close(next: boolean) {
    if (!next) {
      preview.stop();
      setPicked(null);
    }
    onOpenChange(next);
  }

  function confirm() {
    if (picked) onPick(picked);
    close(false);
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-ob-muted">
        {picked ? (
          <>
            Selected: <strong className="text-ob-ink">{picked.name}</strong>
          </>
        ) : (
          "Play a few voices, then pick one."
        )}
      </span>
      <div className="flex gap-2.5">
        <button type="button" className={button({ variant: "secondary" })} onClick={() => close(false)}>
          Cancel
        </button>
        <button type="button" className={button()} disabled={!picked} onClick={confirm}>
          Use this voice
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Choose a voice"
      description={total ? `${new Intl.NumberFormat("en").format(total)} voices match` : "Voices from the ElevenLabs library"}
      toolbar={<VoiceSearchBar value={filters} onChange={setFilters} />}
      footer={footer}
      className="h-[min(94vh,980px)] max-h-none w-[min(calc(100vw-24px),1280px)]"
      bodyClassName="grid grid-cols-1 overflow-y-auto md:grid-cols-[272px_minmax(0,1fr)] md:overflow-hidden"
    >
      <aside className="border-b border-ob-line bg-ob-surface p-5 md:overflow-y-auto md:border-b-0 md:border-r">
        <VoiceFilterPanel value={filters} onChange={setFilters} onReset={() => setFilters({ ...initialFilters, language: "", sort: filters.sort })} />
      </aside>

      <section className="min-w-0 p-5 md:overflow-y-auto" aria-label="Voices">
        {error ? (
          <Alert tone="error">{error.message}</Alert>
        ) : isLoading ? (
          <div className={grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-ob-md bg-ob-line" />
            ))}
          </div>
        ) : voices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center text-ob-muted">
            <SearchX size={28} aria-hidden="true" />
            <span className="font-semibold text-ob-ink">No voices match these filters</span>
            <span className="text-sm">Try removing a filter or searching for something else.</span>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Voices" className={grid}>
              {voices.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  voice={voice}
                  selected={activeId === voice.voice_id}
                  playing={preview.playingId === voice.voice_id}
                  onSelect={() => setPicked(voice)}
                  onTogglePlay={() => preview.toggle(voice.voice_id, voice.preview_url)}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex h-16 items-center justify-center text-sm text-ob-muted">
              {isFetchingNextPage ? <Loader2 size={18} className="animate-spin" aria-label="Loading more voices" /> : !hasNextPage && "That's all of them."}
            </div>
          </>
        )}
      </section>
    </Modal>
  );
}
