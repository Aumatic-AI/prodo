"use client";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";

/** The brand colours the client can set, in brand_kit.colors. */
export const BRAND_COLORS = [
  ["primary", "Primary", "Buttons and highlights"],
  ["secondary", "Secondary", "Supporting colour"],
  ["accent", "Accent", "Badges and details"],
  ["bg", "Background", "Page and card base"],
  ["text", "Text", "Headlines and body copy"],
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A brand colour. The whole tile opens the colour picker, which also takes exact RGB or hex values. */
export function ColorTile({ label, note, value, onChange }: { label: string; note: string; value: string | null; onChange: (v: string | null) => void }) {
  const valid = !!value && HEX.test(value);
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-ob-md border border-ob-line bg-ob-surface transition-[border-color,box-shadow] hover:border-ob-primary hover:shadow-ob-sm has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ob-focus"
      )}
    >
      {/* The swatch shows the client's own brand colour */}
      <span className="block h-20 border-b border-ob-line" style={{ background: valid ? value! : undefined }}>
        {!valid && <span className="grid size-full place-items-center bg-ob-sunken text-xs font-semibold text-ob-faint">Not set</span>}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs text-ob-muted">{note}</span>
        <span className="mt-1 font-mono text-[13px] font-semibold uppercase text-ob-ink-soft">{valid ? value : "Click to pick"}</span>
      </span>
      <input
        type="color"
        aria-label={`${label} colour`}
        value={valid ? value! : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className={cn("absolute inset-0 size-full cursor-pointer opacity-0", focusRing)}
      />
    </label>
  );
}
