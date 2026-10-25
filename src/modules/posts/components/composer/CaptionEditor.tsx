"use client";

import { Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { TextArea } from "@/components/kit/inputs";
import { button, focusRing } from "@/components/kit/styles";
import { platformMeta } from "@/config/platforms";
import { cn } from "@/lib/utils";
import { PlatformMark } from "../PlatformMark";

interface CaptionEditorProps {
  platforms: string[];
  active: string;
  onActive: (platform: string) => void;
  captions: Record<string, string>;
  onChange: (platform: string, text: string) => void;
  onCopyToAll: (text: string) => void;
  onGenerate: () => void;
  generating: boolean;
  onImprove: (platform: string) => void;
  improving: string | null;
  error: string | null;
}

/** One caption per platform, with tabs, a length meter and AI help. */
export function CaptionEditor({ platforms, active, onActive, captions, onChange, onCopyToAll, onGenerate, generating, onImprove, improving, error }: CaptionEditorProps) {
  const text = captions[active] ?? "";
  const max = platformMeta(active).captionMaxLength;
  const used = text.length / max;
  const label = platformMeta(active).label;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Caption per platform" className="flex flex-wrap gap-1.5">
          {platforms.map((p) => {
            const on = p === active;
            const empty = !(captions[p] ?? "").trim();
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onActive(p)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold transition-colors",
                  focusRing,
                  on ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong hover:text-ob-ink"
                )}
              >
                <span className="scale-[0.8]">
                  <PlatformMark platform={p} />
                </span>
                {platformMeta(p).label}
                {empty && <span className="size-1.5 rounded-full bg-ob-warn" title="No caption yet" />}
              </button>
            );
          })}
        </div>
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Write all with AI
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <TextArea
          aria-label={`${label} caption`}
          value={text}
          onValueChange={(v) => onChange(active, v)}
          placeholder={`Write the ${label} caption…`}
          rows={8}
          maxLength={max}
          className="min-h-[200px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ob-line">
              <div
                className={cn("h-full rounded-full transition-[width] duration-200", used > 0.95 ? "bg-ob-danger" : used > 0.8 ? "bg-ob-warn" : "bg-ob-primary")}
                style={{ width: `${Math.min(100, used * 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-ob-muted">
              {text.length.toLocaleString("en")} / {max.toLocaleString("en")}
            </span>
          </div>
          <div className="flex gap-1.5">
            {platforms.length > 1 && (
              <button type="button" className={button({ variant: "quiet", size: "xs" })} onClick={() => onCopyToAll(text)} disabled={!text.trim()}>
                <Copy size={14} /> Use for all
              </button>
            )}
            <button type="button" className={button({ variant: "ghost", size: "xs" })} onClick={() => (text.trim() ? onImprove(active) : onGenerate())} disabled={improving === active || generating}>
              {improving === active ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {text.trim() ? "Improve with AI" : "Write with AI"}
            </button>
          </div>
        </div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
