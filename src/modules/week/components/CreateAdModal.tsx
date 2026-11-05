"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Copy, FileText, GalleryHorizontal, Image as ImageIcon, Sparkles } from "lucide-react";
import { ChoiceCards } from "@/components/kit/choices";
import { DatePicker } from "@/components/kit/DatePicker";
import { Field } from "@/components/kit/Field";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Modal } from "@/components/kit/Modal";
import { Select } from "@/components/kit/Select";
import { TimePicker } from "@/components/kit/TimePicker";
import { button } from "@/components/kit/styles";
import { platformMeta } from "@/config/platforms";
import { POSTING_PLATFORMS } from "@/core/onboarding/options";
import type { Format } from "@/core/creative/brief";
import type { Upload } from "@/core/onboarding/schemas";
import { styleChoices } from "@/core/content/styles";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useResource } from "@/modules/brand/hooks/useResource";
import { useCreateAd } from "../hooks/usePlan";

/** The formats, plus copying a video the owner likes */
type Choice = Format | "copy";

const FORMATS: { value: Choice; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "static", label: "Image ad", description: "One designed image", icon: <ImageIcon size={18} /> },
  { value: "carousel", label: "Carousel", description: "5–8 swipeable slides", icon: <GalleryHorizontal size={18} /> },
  { value: "video", label: "Video", description: "Up to 50 s, edited with music", icon: <Clapperboard size={18} /> },
  { value: "text", label: "Text post", description: "Words only", icon: <FileText size={18} /> },
  { value: "copy", label: "Copy a video", description: "A video you like, with your product", icon: <Copy size={18} /> },
];

const AUTO = "auto";

/** Styles that fit a format, for the style picker. */
function styleOptions(format: Format): { value: string; label: string }[] {
  if (format === "text") return [];
  return [{ value: AUTO, label: "Your top style" }, ...styleChoices(format).map((s) => ({ value: s.id, label: s.label }))];
}

/** Formats each platform can take (TikTok and YouTube: video only; no text-only posts on Instagram or TikTok). */
function fits(format: Format, platform: string): boolean {
  if (format === "text") return ["facebook", "linkedin", "twitter"].includes(platform);
  if (format !== "video") return platformMeta(platform).supportsImages;
  return true;
}

function tomorrow(): { date: string; time: string } {
  const d = new Date(Date.now() + 86400_000);
  return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, time: "10:00" };
}

const NONE = "__none__";

/** "Create ad for…": one post through the whole chain, ready to approve in a few minutes. */
export function CreateAdModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (itemId: string, slotAt: string) => void }) {
  const create = useCreateAd();
  const { data: offerings } = useQuery<{ id: string; name: string }[]>({ queryKey: ["offerings"], queryFn: () => apiFetch("/api/offerings"), enabled: open });
  const { data: personas } = useResource("personas");
  const [format, setFormat] = useState<Choice>("static");
  const copying = format === "copy";
  const made: Format = copying ? "video" : format;
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [idea, setIdea] = useState("");
  const [offeringId, setOfferingId] = useState(NONE);
  const [personaId, setPersonaId] = useState(NONE);
  const [style, setStyle] = useState(AUTO);
  const styles = useMemo(() => (copying ? [] : styleOptions(made)), [copying, made]);
  const [when, setWhen] = useState(tomorrow);
  const [reference, setReference] = useState<Upload[]>([]);
  const [refLink, setRefLink] = useState("");

  const usable = useMemo(() => platforms.filter((p) => fits(made, p)), [platforms, made]);
  const toggle = (p: string) => setPlatforms((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  async function submit() {
    const slotAt = new Date(`${when.date}T${when.time}:00`).toISOString();
    const item = await create.mutateAsync({
      format: made,
      platforms: usable,
      // A copied video takes everything but the product from the reference
      idea: copying ? "" : idea,
      offeringId: offeringId === NONE ? null : offeringId,
      personaId: copying || personaId === NONE ? null : personaId,
      slotAt,
      // A style that doesn't fit the format (after switching formats) falls back to the top pick
      style: !copying && style !== AUTO && styles.some((s) => s.value === style) ? style : null,
      referenceVideoKey: copying ? (reference[0]?.key ?? null) : null,
      referenceUrl: copying && !reference.length && refLink.trim() ? refLink.trim() : null,
    });
    onCreated(item.id, item.slot_at);
    onOpenChange(false);
    setIdea("");
    setReference([]);
    setRefLink("");
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create an ad"
      description="The Creative Director writes it, QA checks it, the Producer makes it, QA checks it again. You approve."
      className="w-[min(calc(100vw-32px),760px)]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-ob-muted">Usually ready in 2–4 minutes for images, about 10 for videos.</span>
          <button type="button" className={button()} disabled={create.isPending || !usable.length || (copying ? (!reference.length && refLink.trim().length < 5) || offeringId === NONE : idea.trim().length < 3)} onClick={submit}>
            <Sparkles size={16} /> {create.isPending ? "Starting…" : "Create ad"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <ChoiceCards options={FORMATS} value={format} onChange={setFormat} label="Format" />

        <Field label="Where it goes" hint={usable.length < platforms.length ? "Greyed-out platforms can't take this format and are left out." : undefined}>
          <div className="flex flex-wrap gap-2">
            {POSTING_PLATFORMS.map((p) => {
              const meta = platformMeta(p);
              const Icon = meta.icon;
              const on = platforms.includes(p);
              const ok = fits(made, p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                    on ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong",
                    on && !ok && "opacity-45"
                  )}
                >
                  <Icon size={15} /> {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        {copying ? (
          <>
            <Field label="Video to copy" hint="Everything comes from this video: its scenes, timing, shots, pace, text and sound. Only the product is yours.">
              <MediaUploader purpose="referenceVideo" max={1} value={reference} onChange={setReference} />
            </Field>
            {!reference.length && (
              <Field label="Or paste a link" htmlFor="ref-link" optional hint="A Meta Ad Library ad, an Instagram, TikTok or YouTube video, or a link to a video file.">
                <TextInput id="ref-link" value={refLink} onValueChange={setRefLink} placeholder="https://www.facebook.com/ads/library/?id=…" />
              </Field>
            )}
            <Field label="Product">
              <Select
                value={offeringId === NONE ? null : offeringId}
                onValueChange={setOfferingId}
                searchable
                placeholder="Pick the product for this video"
                options={(offerings ?? []).map((o) => ({ value: o.id, label: o.name }))}
              />
            </Field>
          </>
        ) : (
          <>
          <Field label="What is it about?" htmlFor="ad-idea" hint='In your own words, e.g. "Our autumn sale on sofas" or "Why customers choose our same-day service".'>
            <TextArea id="ad-idea" rows={3} value={idea} onValueChange={setIdea} placeholder="Describe the ad…" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product or service" optional>
              <Select
                value={offeringId}
                onValueChange={setOfferingId}
                searchable
                options={[{ value: NONE, label: "None: about the brand" }, ...(offerings ?? []).map((o) => ({ value: o.id, label: o.name }))]}
              />
            </Field>
            <Field label="Speaks to" optional>
              <Select
                value={personaId}
                onValueChange={setPersonaId}
                options={[{ value: NONE, label: "Let Prodo choose" }, ...(personas ?? []).filter((p) => p.active !== false).map((p) => ({ value: String(p.id), label: String(p.name) }))]}
              />
            </Field>
          </div>
          </>
        )}

        {styles.length > 0 && (
          <Field label="Style" optional hint="How it looks: your top style from Settings → Content, or pick one for this ad.">
            <Select value={styles.some((s) => s.value === style) ? style : AUTO} onValueChange={setStyle} options={styles} />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Goes out on">
            <DatePicker value={when.date} min={tomorrow().date} onChange={(date) => setWhen((w) => ({ ...w, date }))} />
          </Field>
          <Field label="At">
            <TimePicker value={when.time} onChange={(time) => setWhen((w) => ({ ...w, time }))} />
          </Field>
        </div>

        {create.error && <p className="m-0 text-sm text-ob-danger">{create.error.message}</p>}
      </div>
    </Modal>
  );
}
