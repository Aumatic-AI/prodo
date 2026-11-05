"use client";

import { useState } from "react";
import { Clapperboard, GalleryHorizontal, Image as ImageIcon, Wand2 } from "lucide-react";
import { Counter } from "@/components/kit/controls";
import { DatePicker } from "@/components/kit/DatePicker";
import { Field } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { button } from "@/components/kit/styles";
import { useAutoCreate, type AutoCounts, type AutoKind } from "../hooks/usePlan";

const MAX_POSTS = 10;

const KINDS: { value: AutoKind; label: string; hint: string; unit: [string, string]; icon: React.ReactNode }[] = [
  { value: "static", label: "Image ads", hint: "Designed images, about $0.10 each", unit: ["image", "images"], icon: <ImageIcon size={18} /> },
  { value: "carousel", label: "Carousels", hint: "5–8 swipeable slides, about $0.15 each", unit: ["carousel", "carousels"], icon: <GalleryHorizontal size={18} /> },
  { value: "video", label: "Videos", hint: "Up to 50 s, edited with music, about $1 each", unit: ["video", "videos"], icon: <Clapperboard size={18} /> },
];

/** Starting point: two images and one video */
const DEFAULT_COUNTS: AutoCounts = { static: 2, carousel: 0, video: 1 };

/**
 * "Auto-create": say how many images, carousels and videos; the Planner chooses the products, people,
 * angles, styles and times from the brand, the learnings and your content settings, and every post is
 * made like a single ad, ready to approve. Nothing to type.
 */
export function AutoCreateModal({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (o: boolean) => void; onStarted: (weekStart: string) => void }) {
  const start = useAutoCreate();
  const [counts, setCounts] = useState<AutoCounts>(DEFAULT_COUNTS);
  // "" = spread over the next days; a day puts every post on it
  const [date, setDate] = useState("");
  const total = counts.static + counts.carousel + counts.video;
  const tomorrow = new Date(Date.now() + 86400_000);
  const minDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const weekday = date ? new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${date}T12:00:00`)) : null;

  async function submit() {
    const res = await start.mutateAsync({ ...counts, ...(date ? { date } : {}) });
    onStarted(res.weekStart);
    onOpenChange(false);
  }

  const summary = KINDS.filter((k) => counts[k.value] > 0)
    .map((k) => `${counts[k.value]} ${k.unit[counts[k.value] === 1 ? 0 : 1]}`)
    .join(", ");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Auto-create posts"
      description="Prodo chooses what to make from your brand, your content settings and what has worked, then makes each post. You only approve."
      className="w-[min(calc(100vw-32px),680px)]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-ob-muted">{total ? `${summary}. Planned in about a minute, made in 2–10.` : "Pick at least one post."}</span>
          <button type="button" className={button()} disabled={start.isPending || total < 1} onClick={submit}>
            <Wand2 size={16} /> {start.isPending ? "Starting…" : `Create ${total} post${total === 1 ? "" : "s"}`}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {KINDS.map((k) => (
          <Field key={k.value} label={k.label} hint={k.hint}>
            <Counter
              label={k.unit[1]}
              value={counts[k.value]}
              onChange={(n) => setCounts((c) => ({ ...c, [k.value]: n }))}
              min={0}
              max={Math.max(0, MAX_POSTS - (total - counts[k.value]))}
              unit={k.unit[counts[k.value] === 1 ? 0 : 1]}
            />
          </Field>
        ))}
        <Field label="Which day?" hint={date ? `Every post goes out on ${weekday}, at different times.` : "Leave empty to spread them over the next days, starting tomorrow."}>
          <span className="inline-flex items-center gap-2">
            <DatePicker id="auto-create-date" value={date} onChange={setDate} min={minDate} placeholder="Next few days" aria-label="Day to post" />
            {date && (
              <button type="button" className={button({ variant: "ghost" })} onClick={() => setDate("")}>
                Clear
              </button>
            )}
          </span>
        </Field>
        <p className="m-0 text-[13px] text-ob-muted">Up to {MAX_POSTS} posts at a time, on the platforms you post to.</p>
        {start.error && <p className="m-0 text-sm text-ob-danger">{start.error.message}</p>}
      </div>
    </Modal>
  );
}
