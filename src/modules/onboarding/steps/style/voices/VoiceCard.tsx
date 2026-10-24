"use client";

import { Check, Pause, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Voice } from "@/providers/ai/registry";
import { focusRing } from "@/components/kit/styles";

interface VoiceCardProps {
  voice: Voice;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onTogglePlay: () => void;
}

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const compact = new Intl.NumberFormat("en", { notation: "compact" });

export function VoiceCard({ voice, selected, playing, onSelect, onTogglePlay }: VoiceCardProps) {
  const meta = [voice.gender, voice.age, voice.accent].filter(Boolean).map(titleCase).join(" · ");
  const tags = [voice.descriptive, voice.use_case].filter(Boolean).map(titleCase);

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={cn(
        "relative flex cursor-pointer flex-col gap-3 rounded-ob-md border bg-ob-surface p-4 transition-[border-color,box-shadow] duration-150",
        focusRing,
        selected ? "border-ob-primary shadow-[inset_0_0_0_1px_var(--color-ob-primary)]" : "border-ob-line hover:border-ob-line-strong hover:shadow-ob-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={playing ? `Stop ${voice.name}` : `Play ${voice.name}`}
          disabled={!voice.preview_url}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40",
            focusRing,
            playing ? "bg-ob-primary text-ob-on-primary" : "bg-ob-dark text-ob-on-dark hover:bg-ob-ink-soft"
          )}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{voice.name}</span>
          <span className="truncate text-xs text-ob-muted">{meta || titleCase(voice.language)}</span>
        </div>
        {selected && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ob-primary text-ob-on-primary" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </div>

      {voice.description && <p className="m-0 line-clamp-2 text-[13px] text-ob-ink-soft">{voice.description}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {voice.featured && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ob-warn-soft px-2 py-0.5 text-[11px] font-semibold text-ob-warn">
            <Star size={11} />
            Featured
          </span>
        )}
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-ob-sunken px-2 py-0.5 text-[11px] font-semibold text-ob-muted">
            {t}
          </span>
        ))}
        {voice.cloned_by_count > 0 && <span className="ml-auto text-[11px] text-ob-faint">{compact.format(voice.cloned_by_count)} uses</span>}
      </div>
    </div>
  );
}
