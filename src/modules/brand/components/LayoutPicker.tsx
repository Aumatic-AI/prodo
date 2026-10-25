"use client";

import { Check } from "lucide-react";
import { focusRing } from "@/components/kit/styles";
import { TEMPLATE_IDS, type TemplateId } from "@/core/creative/brief";
import type { KitInput } from "@/core/brand/kit";
import { cn } from "@/lib/utils";

const INFO: Record<TemplateId, { name: string; note: string }> = {
  spotlight: { name: "Spotlight", note: "Full photo, words over a dark fade at the bottom" },
  split: { name: "Split", note: "Photo on top, words in a clean panel" },
  frame: { name: "Frame", note: "Premium dark canvas, photo as a card" },
  bold: { name: "Bold", note: "Headline in a solid brand block" },
};

/** A tiny drawing of each layout in the brand's own colours. */
function Sketch({ id, colors }: { id: TemplateId; colors: KitInput["colors"] }) {
  const primary = colors.primary ?? "#15171c";
  const accent = colors.accent ?? colors.secondary ?? primary;
  const photo = "linear-gradient(135deg, #e9d6bf, #b9886a)";
  const line = (w: string, bg: string, h = 6) => <div className="rounded-full" style={{ width: w, height: h, background: bg }} />;
  if (id === "spotlight") {
    return (
      <div className="relative size-full" style={{ background: photo }}>
        <div className="absolute inset-x-0 bottom-0 flex h-1/2 flex-col justify-end gap-1.5 bg-linear-to-b from-transparent to-black/80 p-3">
          {line("80%", "#fff", 8)}
          {line("55%", "#fff", 8)}
          <div className="mt-1 h-3.5 w-12 rounded-full" style={{ background: primary }} />
        </div>
      </div>
    );
  }
  if (id === "split") {
    return (
      <div className="flex size-full flex-col">
        <div className="h-[56%]" style={{ background: photo }} />
        <div className="flex flex-1 flex-col justify-center gap-1.5 p-3" style={{ background: colors.bg }}>
          {line("80%", colors.text, 7)}
          {line("50%", colors.text, 7)}
          <div className="mt-1 h-3.5 w-12 rounded-full" style={{ background: primary }} />
        </div>
      </div>
    );
  }
  if (id === "frame") {
    return (
      <div className="flex size-full flex-col gap-1.5 p-3" style={{ background: "#1d2a26" }}>
        {line("75%", "#fff", 7)}
        {line("45%", "#fff", 7)}
        <div className="relative mt-1 flex-1 rounded-md" style={{ background: photo }}>
          <div className="absolute bottom-1.5 left-1.5 h-3 w-10 rounded-full" style={{ background: primary }} />
        </div>
      </div>
    );
  }
  return (
    <div className="relative size-full" style={{ background: photo }}>
      <div className="absolute inset-x-3 bottom-8 flex flex-col gap-1.5 rounded-md p-2" style={{ background: primary }}>
        {line("85%", "#fff", 7)}
        {line("60%", "#fff", 7)}
      </div>
      <div className="absolute bottom-2.5 left-3 h-3.5 w-12 rounded-full" style={{ background: accent }} />
    </div>
  );
}

export function LayoutPicker({ value, onChange, colors }: { value: TemplateId[]; onChange: (v: TemplateId[]) => void; colors: KitInput["colors"] }) {
  const all = value.length === 0;
  const toggle = (id: TemplateId) => {
    const current = all ? [...TEMPLATE_IDS] : value;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    // Every layout picked is the same as none: keep it empty
    onChange(next.length === TEMPLATE_IDS.length ? [] : next);
  };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TEMPLATE_IDS.map((id) => {
        const on = all || value.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(id)}
            disabled={on && !all && value.length === 1}
            title={on && !all && value.length === 1 ? "Keep at least one layout" : undefined}
            className={cn(
              "group flex flex-col overflow-hidden rounded-ob-md border bg-ob-surface text-left transition-[border-color,box-shadow,opacity] duration-150",
              on ? "border-ob-primary shadow-ob-sm ring-2 ring-ob-primary/15" : "border-ob-line opacity-60 hover:opacity-100",
              focusRing
            )}
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              <Sketch id={id} colors={colors} />
              {on && (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ob-primary text-ob-on-primary shadow-ob-sm">
                  <Check size={13} />
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-sm font-bold">{INFO[id].name}</span>
              <span className="text-xs text-ob-muted">{INFO[id].note}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
