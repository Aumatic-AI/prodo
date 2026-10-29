"use client";

import { useMemo, useState } from "react";
import { Check, Library, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/kit/Field";
import { button, focusRing } from "@/components/kit/styles";
import type { Voice } from "@/providers/ai/registry";
import { useVoiceSearch, type VoiceFilterState } from "@/modules/onboarding/hooks/useVoiceSearch";
import { useAudioPreview } from "@/modules/onboarding/hooks/useAudioPreview";
import { voiceLanguageFor } from "@/modules/onboarding/config";
import { VoiceBrowser } from "@/modules/onboarding/steps/content/voices/VoiceBrowser";

export interface VoiceChoice {
  id: string;
  name: string;
}

const SUGGESTED = 4;

interface VoiceFieldProps {
  value: VoiceChoice | null;
  onChange: (voice: VoiceChoice) => void;
  /** Business language code, to suggest voices that speak it */
  languageCode: string;
  error?: string;
}

/** Suggested voices to play and pick, the brand's saved voice first, and the full library. */
export function VoiceField({ value, onChange, languageCode, error }: VoiceFieldProps) {
  const [browsing, setBrowsing] = useState(false);
  const preview = useAudioPreview();
  const filters = useMemo<VoiceFilterState>(
    () => ({ search: "", language: voiceLanguageFor(languageCode), accent: "", gender: "", age: "", category: "", useCases: [], featured: false, sort: "trending" }),
    [languageCode]
  );
  const { data, isLoading } = useVoiceSearch(filters, true);
  const suggested = data?.pages[0]?.voices.slice(0, SUGGESTED) ?? [];
  // Keep the chosen voice visible even when it isn't in the suggestions
  const showCurrent = value && !suggested.some((v) => v.voice_id === value.id);

  const pick = (v: Voice) => onChange({ id: v.voice_id, name: v.name });

  const chip = (id: string, name: string, meta: string, previewUrl: string | null) => {
    const on = value?.id === id;
    const playing = preview.playingId === id;
    return (
      <div
        key={id}
        role="radio"
        aria-checked={on}
        tabIndex={0}
        onClick={() => onChange({ id, name })}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onChange({ id, name }))}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-ob-md border bg-ob-surface p-2.5 pr-3 transition-[border-color,box-shadow] duration-150",
          focusRing,
          on ? "border-ob-primary shadow-[inset_0_0_0_1px_var(--color-ob-primary)]" : "border-ob-line hover:border-ob-line-strong hover:shadow-ob-sm"
        )}
      >
        <button
          type="button"
          aria-label={playing ? `Stop ${name}` : `Play ${name}`}
          disabled={!previewUrl}
          onClick={(e) => {
            e.stopPropagation();
            if (previewUrl) preview.toggle(id, previewUrl);
          }}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-35",
            focusRing,
            playing ? "bg-ob-primary text-ob-on-primary" : "bg-ob-dark text-ob-on-dark hover:bg-ob-ink-soft"
          )}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="translate-x-px" />}
        </button>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{name}</span>
          <span className="truncate text-xs capitalize text-ob-muted">{meta}</span>
        </span>
        {on && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ob-primary text-ob-on-primary">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>
    );
  };

  return (
    <Field label="Voice" error={error}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Voices">
        {showCurrent && chip(value.id, value.name, "Your brand voice", null)}
        {isLoading
          ? Array.from({ length: SUGGESTED }).map((_, i) => <div key={i} className="h-[58px] animate-pulse rounded-ob-md bg-ob-line" />)
          : suggested.map((v) => chip(v.voice_id, v.name, [v.gender, v.accent, v.descriptive].filter(Boolean).join(" · "), v.preview_url || null))}
      </div>
      <button
        type="button"
        className={cn(button({ variant: "secondary", size: "sm" }), "self-start")}
        onClick={() => {
          preview.stop();
          setBrowsing(true);
        }}
      >
        <Library size={15} /> Browse all voices
      </button>
      <VoiceBrowser open={browsing} onOpenChange={setBrowsing} initialFilters={filters} selectedId={value?.id ?? null} onPick={pick} />
    </Field>
  );
}
