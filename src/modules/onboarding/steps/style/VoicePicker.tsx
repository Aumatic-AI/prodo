"use client";

import { useMemo, useState } from "react";
import { Library, X } from "lucide-react";
import type { Voice } from "@/providers/ai/registry";
import { Alert } from "../../components/blocks";
import { button, label } from "@/components/kit/styles";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { useVoiceSearch, type VoiceFilterState } from "../../hooks/useVoiceSearch";
import { useAudioPreview } from "../../hooks/useAudioPreview";
import { voiceLanguageFor } from "../../config";
import { VoiceBrowser } from "./voices/VoiceBrowser";
import { VoiceCard } from "./voices/VoiceCard";

const SUGGESTED = 6;

/** A few suggested voices to play and pick, plus the full library in a modal. */
export function VoicePicker() {
  const { value, update } = useSlice("style");
  const language = useOnboarding((s) => s.draft.basics.language);
  const [open, setOpen] = useState(false);
  const preview = useAudioPreview();

  // Same filters the modal opens with, so its first page is already cached
  const filters = useMemo<VoiceFilterState>(
    () => ({ search: "", language: voiceLanguageFor(language), accent: "", gender: "", age: "", category: "", useCases: [], featured: false, sort: "trending" }),
    [language]
  );
  const { data, isLoading, error } = useVoiceSearch(filters, true);
  const firstPage = data?.pages[0];
  const suggested = firstPage?.voices.slice(0, SUGGESTED) ?? [];

  const pick = (voice: Voice) => update("style", { voiceId: voice.voice_id, voiceName: voice.name });

  function openLibrary() {
    preview.stop();
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={label}>
            Voice <span className="font-normal text-ob-muted">(optional)</span>
          </span>
          <span className="text-[13px] text-ob-muted">
            {value.voiceName ? (
              <>
                Selected: <strong className="text-ob-ink">{value.voiceName}</strong>, used for every video voice-over.
              </>
            ) : (
              "Play a few and pick one, or browse the full library."
            )}
          </span>
        </div>
        {value.voiceId && (
          <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => update("style", { voiceId: null, voiceName: null })}>
            <X size={14} />
            Remove voice
          </button>
        )}
      </div>

      {error ? (
        <Alert tone="warn">Voices can&apos;t be loaded right now. You can pick one later in Settings.</Alert>
      ) : (
        <div role="radiogroup" aria-label="Suggested voices" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
          {isLoading
            ? Array.from({ length: SUGGESTED }).map((_, i) => <div key={i} className="h-[150px] animate-pulse rounded-ob-md bg-ob-line" />)
            : suggested.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  voice={voice}
                  selected={value.voiceId === voice.voice_id}
                  playing={preview.playingId === voice.voice_id}
                  onSelect={() => pick(voice)}
                  onTogglePlay={() => preview.toggle(voice.voice_id, voice.preview_url)}
                />
              ))}
        </div>
      )}

      <button type="button" className={button({ variant: "secondary" })} onClick={openLibrary} disabled={!!error}>
        <Library size={16} />
        Browse all {firstPage?.total ? new Intl.NumberFormat("en").format(firstPage.total) : ""} voices
      </button>

      <VoiceBrowser open={open} onOpenChange={setOpen} initialFilters={filters} selectedId={value.voiceId} onPick={pick} />
    </div>
  );
}
