"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { Field } from "@/components/kit/Field";
import { TextArea } from "@/components/kit/inputs";
import { SaveBar } from "@/components/kit/SaveBar";
import { Skeleton } from "@/components/kit/Skeleton";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { BrandKit, KitInput } from "@/core/brand/kit";
import { BLACK, readablePairs, WHITE } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useKit, useSaveKit } from "../hooks/useResource";
import { LayoutPicker } from "./LayoutPicker";
import { BRAND_COLORS as COLORS, ColorTile } from "@/components/kit/ColorTile";
import { FontSelect } from "@/components/kit/FontSelect";

const HEX = /^#[0-9a-fA-F]{6}$/;

const toForm = (k: BrandKit): KitInput => ({
  colors: { primary: k.colors.primary, secondary: k.colors.secondary, accent: k.colors.accent, bg: k.colors.bg, text: k.colors.text },
  fonts: { heading: k.fonts.heading, body: k.fonts.body },
  photo_style: k.photo_style,
  layout_style: k.layout_style,
  template_ids: k.template_ids ?? [],
});

/** Colours, fonts, logo versions and visual style. Saving works out the readable colour pairs again. */
export function KitTab() {
  const { data: kit, isLoading, error } = useKit();
  const save = useSaveKit();
  const [form, setForm] = useState<KitInput | null>(null);

  useEffect(() => {
    if (kit) setForm(toForm(kit));
  }, [kit]);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !kit || !form) return <Skeleton className="h-96" />;

  const saved = toForm(kit);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const c = form.colors;
  const setColor = (key: keyof KitInput["colors"], v: string | null) =>
    setForm({ ...form, colors: { ...c, [key]: key === "bg" || key === "text" ? (v ?? (key === "bg" ? WHITE : BLACK)) : v } });
  const validColors = Object.values(c).every((v) => v === null || HEX.test(v));
  // Live preview of what ads will use, worked out the same way as on save
  const pairs = validColors
    ? readablePairs(
        [
          ["Primary", c.primary],
          ["Secondary", c.secondary],
          ["Accent", c.accent],
          ["Background", c.bg],
          ["Text", c.text],
        ],
        [WHITE, BLACK, c.text, c.bg]
      )
    : [];
  const logos = [
    ["Original", kit.logo_variants.full, "bg-ob-surface"],
    ["On light backgrounds", kit.logo_variants.light, "bg-white"],
    ["On dark backgrounds", kit.logo_variants.dark, "bg-ob-dark"],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <Card title="Colours" description="Click a colour to change it. Ads only put text on pairs that are easy to read (WCAG AA, at least 4.5:1).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {COLORS.map(([key, label, note]) => (
            <ColorTile key={key} label={label} note={note} value={c[key]} onChange={(v) => setColor(key, v)} />
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-ob-muted">Readable text pairs</span>
          {!validColors ? (
            <p className="m-0 text-sm text-ob-danger">Use colours like #1A2B3C to see the pairs.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {pairs.map((p) => (
                <div key={p.name} className="flex min-w-[130px] flex-col gap-1 rounded-ob-md border border-ob-line px-4 py-3" style={{ background: p.bg, color: p.text }}>
                  <span className="text-lg font-extrabold leading-none">Aa</span>
                  <span className="text-xs font-semibold opacity-90">
                    {p.name} · {p.ratio}:1
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Fonts" description="Used for headlines and body text on ads.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(
            [
              ["heading", "Headings"],
              ["body", "Body text"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`font-${key}`}>
              <FontSelect id={`font-${key}`} role={key} value={form.fonts[key]} onChange={(v) => setForm({ ...form, fonts: { ...form.fonts, [key]: v } })} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Logo versions" description="Made from your logo by the Visual Identity Analyst. Change the logo itself in Settings.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {logos.map(([label, key, bg]) => (
            <figure key={label} className="m-0 flex flex-col gap-2">
              <div className={cn("grid h-28 place-items-center rounded-ob-md border border-ob-line", bg)}>
                {key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={publicUrl(key)} alt={label} className="max-h-[65%] max-w-[70%] object-contain" />
                ) : (
                  <span className="text-xs font-semibold text-ob-faint">Not available</span>
                )}
              </div>
              <figcaption className="text-[13px] font-semibold text-ob-muted">{label}</figcaption>
            </figure>
          ))}
        </div>
      </Card>

      <Card title="Visual style" description="Guides image generation and layouts.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Photo style" htmlFor="photo-style">
            <TextArea id="photo-style" rows={5} value={form.photo_style ?? ""} onValueChange={(v) => setForm({ ...form, photo_style: v || null })} />
          </Field>
          <Field label="Layout style" htmlFor="layout-style">
            <TextArea id="layout-style" rows={5} value={form.layout_style ?? ""} onValueChange={(v) => setForm({ ...form, layout_style: v || null })} />
          </Field>
        </div>
      </Card>

      <Card title="Ad layouts" description="Which designs the agents may use for image ads. None picked means all four.">
        <LayoutPicker value={form.template_ids} onChange={(template_ids) => setForm({ ...form, template_ids })} colors={c} />
      </Card>

      <SaveBar
        show={dirty}
        saving={save.isPending}
        error={!validColors ? "Use colours like #1A2B3C" : save.error?.message}
        onSave={() => validColors && save.mutate(form)}
        onDiscard={() => setForm(saved)}
      />
    </div>
  );
}
