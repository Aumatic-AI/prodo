"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ExternalLink, RefreshCw, SkipForward } from "lucide-react";
import { Modal } from "@/components/kit/Modal";
import { TextArea } from "@/components/kit/inputs";
import { button } from "@/components/kit/styles";
import { LABELS } from "@/core/creative/brief";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { useItemAction } from "../../hooks/usePlan";
import { ITEM_STATUS } from "../../lib/status";
import { slotWhen } from "../../lib/time";
import { StatusPill } from "../StatusPill";
import { SlotPreview } from "./SlotPreview";
import { ActivityTab, BriefTab, CaptionsTab, QualityTab, WhyTab } from "./SlotTabs";

type Tab = "why" | "brief" | "captions" | "quality" | "activity";
const TABS: { value: Tab; label: string }[] = [
  { value: "why", label: "Why" },
  { value: "brief", label: "Brief" },
  { value: "captions", label: "Captions" },
  { value: "quality", label: "Quality" },
  { value: "activity", label: "Activity" },
];

/** Everything about one planned post, and what the client can do with it. */
export function SlotDetail({ item, timezone, onClose }: { item: PlanItemView | null; timezone: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("why");
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"idle" | "redo" | "skip">("idle");
  const [note, setNote] = useState("");
  const action = useItemAction();

  useEffect(() => {
    setCaptions(item?.captions ?? {});
  }, [item?.id, item?.captions]);
  useEffect(() => {
    setTab("why");
    setMode("idle");
    setNote("");
  }, [item?.id]);

  if (!item) return null;
  const working = !!ITEM_STATUS[item.status].working;
  const editable = !working && !["scheduled", "published"].includes(item.status);
  const canApprove = (item.status === "ready" || item.status === "needs_review") && !!item.selected_media_id;
  const canRedo = !working && !["scheduled", "published"].includes(item.status);
  const run = (a: "approve" | "reject" | "regenerate" | "schedule", n?: string) =>
    action.mutate({ id: item.id, action: a, note: n || null }, { onSuccess: () => (a === "approve" || a === "reject" ? onClose() : setMode("idle")) });

  const footer = (
    <div className="flex flex-col gap-3">
      {mode !== "idle" && (
        <div className="flex flex-col gap-2">
          <TextArea
            rows={2}
            autoFocus
            value={note}
            placeholder={mode === "redo" ? 'What should change? e.g. "Make it punchier", "Use the blue sofa", "Shorter video"' : "Why skip it? (optional, helps the agents learn)"}
            onValueChange={setNote}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className={button({ variant: "quiet", size: "sm" })} onClick={() => setMode("idle")}>
              Back
            </button>
            {mode === "redo" ? (
              <button type="button" className={button({ size: "sm" })} disabled={action.isPending} onClick={() => run("regenerate", note)}>
                <RefreshCw size={14} /> Make it again
              </button>
            ) : (
              <button type="button" className={button({ variant: "dangerSolid", size: "sm" })} disabled={action.isPending} onClick={() => run("reject", note)}>
                <SkipForward size={14} /> Skip this post
              </button>
            )}
          </div>
        </div>
      )}
      {mode === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {canRedo && (
              <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setMode("redo")}>
                <RefreshCw size={14} /> {item.status === "failed" ? "Try again" : "Make again"}
              </button>
            )}
            {canRedo && item.status !== "rejected" && (
              <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => setMode("skip")}>
                <SkipForward size={14} /> Skip
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.post && (
              <Link href={`/posts/${item.post.id}`} className={button({ variant: "secondary", size: "sm" })}>
                <ExternalLink size={14} /> Open post
              </Link>
            )}
            {item.status === "approved" && item.error && (
              <button type="button" className={button({ size: "sm" })} disabled={action.isPending} onClick={() => run("schedule")}>
                <CalendarClock size={14} /> Schedule again
              </button>
            )}
            {canApprove && (
              <button type="button" className={button({ size: "sm" })} disabled={action.isPending} onClick={() => run("approve")}>
                <Check size={15} /> Approve
              </button>
            )}
          </div>
        </div>
      )}
      {action.error && <p className="m-0 text-sm text-ob-danger">{action.error.message}</p>}
    </div>
  );

  return (
    <Modal
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      title={item.hook_text ?? item.angle ?? "Planned post"}
      description={`${LABELS.format[item.format]} · ${slotWhen(item.slot_at, timezone)}`}
      // A fixed height on tablets and up, so the preview can fit itself into exactly the space left
      className="w-[min(calc(100vw-32px),1080px)] md:h-[min(88vh,820px)]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto md:overflow-hidden"
      footer={footer}
    >
      <div className="grid min-h-0 grid-cols-1 md:h-full md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4 border-b border-ob-line bg-ob-sunken/60 p-4 sm:p-5 md:overflow-hidden md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2">
            <StatusPill status={item.status} size="md" />
            {item.qa_score !== null && <span className="text-xs font-semibold text-ob-muted">QA {item.qa_score}/10</span>}
          </div>
          {item.error && <p className="m-0 rounded-ob-md bg-ob-danger-soft px-3 py-2 text-[13px] text-ob-danger">{item.error}</p>}
          <SlotPreview item={item} captions={captions} />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-ob-line px-5 pt-3" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[13.5px] font-semibold transition-colors",
                  tab === t.value ? "border-ob-primary text-ob-primary" : "border-transparent text-ob-muted hover:text-ob-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 p-4 sm:p-5 md:overflow-y-auto">
            {tab === "why" && <WhyTab item={item} />}
            {tab === "brief" && <BriefTab item={item} />}
            {tab === "captions" && <CaptionsTab item={item} captions={captions} setCaptions={setCaptions} editable={editable} />}
            {tab === "quality" && <QualityTab item={item} />}
            {tab === "activity" && <ActivityTab item={item} live={working} />}
          </div>
        </div>
      </div>
    </Modal>
  );
}
