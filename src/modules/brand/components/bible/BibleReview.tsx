"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, History, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { Card } from "@/components/kit/Card";
import { EmptyState } from "@/components/kit/EmptyState";
import { Field } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { Skeleton } from "@/components/kit/Skeleton";
import { TextArea } from "@/components/kit/inputs";
import { button } from "@/components/kit/styles";
import type { BibleStatus } from "@/core/brand/bible";
import { cn } from "@/lib/utils";
import { isWriting, useApproveBible, useBibleOverview, useBibleVersion, useRegenerateBible, useSaveBible } from "../../hooks/useBible";
import { BibleEditor } from "./BibleEditor";
import { BibleView } from "./BibleView";
import { PendingFacts } from "./PendingFacts";
import { SourcesDialog, useSourcesDialog } from "./Sources";

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const STATUS: Record<BibleStatus, { label: string; tone: "success" | "warn" | "neutral" }> = {
  approved: { label: "Approved", tone: "success" },
  draft: { label: "Draft", tone: "warn" },
  superseded: { label: "Older version", tone: "neutral" },
};

interface BibleReviewProps {
  /** Version history is shown in the Brand Hub only */
  showHistory?: boolean;
  onApproved?: () => void;
}

/**
 * Read, check sources, confirm found facts, edit (new version), regenerate with a note, approve.
 * Used for the onboarding review and the Brand Hub's Brand Bible tab.
 */
export function BibleReview({ showHistory = false, onApproved }: BibleReviewProps) {
  const { data: overview, isLoading, error } = useBibleOverview();
  const save = useSaveBible();
  const approve = useApproveBible();
  const regenerate = useRegenerateBible();
  const sources = useSourcesDialog();
  const [editing, setEditing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const past = useBibleVersion(viewingId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-20" />
        <Skeleton className="h-56" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (error || !overview) return <Alert tone="error">{error?.message ?? "Couldn't load the Brand Bible"}</Alert>;

  const writing = isWriting(overview);
  const current = overview.draft ?? overview.approved;
  const shown = viewingId && past.data ? past.data : current;
  const isPast = !!viewingId && shown?.id !== current?.id;
  const failed = overview.strategist?.state === "failed";

  if (!current || !shown) {
    return writing ? (
      <EmptyState icon={Sparkles} title="Writing your Brand Bible" description="The Brand Strategist is turning the research into your Brand Bible. This takes a minute or two." />
    ) : (
      <EmptyState
        icon={BookOpen}
        title={failed ? "The Brand Bible couldn't be written" : "No Brand Bible yet"}
        description={failed ? overview.strategist?.error : "It's written after your brand research finishes."}
        action={
          failed ? (
            <button type="button" className={button({ size: "sm" })} onClick={() => regenerate.mutate("")}>
              <RefreshCw size={15} /> Try again
            </button>
          ) : undefined
        }
      />
    );
  }

  async function onApprove() {
    if (!overview?.draft) return;
    await approve.mutateAsync(overview.draft.id);
    onApproved?.();
  }

  const status = STATUS[shown.status];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-ob-lg border border-ob-line bg-ob-surface px-5 py-4 shadow-ob-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-ob bg-ob-primary-soft text-ob-primary">
            <BookOpen size={19} />
          </span>
          <div className="flex flex-col">
            <span className="flex items-center gap-2">
              <strong className="text-base">Brand Bible v{shown.version}</strong>
              <Badge tone={status.tone} size="sm">
                {status.label}
              </Badge>
            </span>
            <span className="text-[13px] text-ob-muted">
              {shown.status === "approved" && shown.approved_at ? `Approved ${date(shown.approved_at)}` : `Written ${date(shown.created_at)}`}
              {overview.draft && overview.approved && !isPast && ` · v${overview.approved.version} stays in use until you approve this`}
            </span>
          </div>
        </div>
        {isPast ? (
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setViewingId(null)}>
            Back to the current version
          </button>
        ) : (
          !editing && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setEditing(true)} disabled={writing}>
                <Pencil size={15} /> Edit
              </button>
              <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setNoteOpen(true)} disabled={writing}>
                <RefreshCw size={15} /> Regenerate
              </button>
              {overview.draft && (
                <button type="button" className={button({ size: "sm" })} onClick={onApprove} disabled={writing || approve.isPending}>
                  {approve.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Approve
                </button>
              )}
            </div>
          )
        )}
      </section>

      {writing && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Writing a new draft. It appears here when it&apos;s ready.
          </span>
        </Alert>
      )}
      {failed && !writing && <Alert tone="error">The last draft couldn&apos;t be written: {overview.strategist?.error}</Alert>}
      {(approve.error || regenerate.error) && <Alert tone="error">{(approve.error ?? regenerate.error)?.message}</Alert>}

      {!isPast && <PendingFacts />}
      {overview.draft && overview.pendingCount > 0 && !isPast && (
        <p className="m-0 -mt-2 text-[13px] text-ob-muted">You can approve now; facts you haven&apos;t confirmed stay unused until you confirm them.</p>
      )}

      {editing ? (
        <BibleEditor
          initial={current.content}
          saving={save.isPending}
          onCancel={() => setEditing(false)}
          onSave={async (content) => {
            await save.mutateAsync(content);
            setEditing(false);
          }}
        />
      ) : (
        <BibleView content={shown.content} onShowSources={sources.show} />
      )}

      {showHistory && overview.versions.length > 1 && (
        <Card title="Version history" actions={<History size={18} className="text-ob-faint" />}>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {overview.versions.map((v) => {
              const s = STATUS[v.status];
              const active = shown.id === v.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setViewingId(v.id === current.id ? null : v.id)}
                    className={cn("flex w-full items-center gap-3 rounded-ob px-3 py-2.5 text-left text-sm transition-colors", active ? "bg-ob-primary-soft" : "hover:bg-ob-sunken")}
                  >
                    <strong className="w-10">v{v.version}</strong>
                    <Badge tone={s.tone} size="sm">
                      {s.label}
                    </Badge>
                    <span className="ml-auto text-[13px] text-ob-muted">{date(v.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <SourcesDialog refs={sources.refs} onClose={sources.close} />
      <Modal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Regenerate with a note"
        description="Tell the Brand Strategist what to change. It rewrites the draft from the same research."
        className="w-[min(calc(100vw-32px),560px)]"
        footer={
          <div className="flex justify-end gap-2.5">
            <button type="button" className={button({ variant: "secondary" })} onClick={() => setNoteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={button()}
              disabled={regenerate.isPending}
              onClick={async () => {
                await regenerate.mutateAsync(note);
                setNote("");
                setNoteOpen(false);
              }}
            >
              {regenerate.isPending && <Loader2 size={16} className="animate-spin" />}
              Write a new draft
            </button>
          </div>
        }
      >
        <Field label="What should change?" optional>
          <TextArea rows={4} value={note} placeholder="e.g. Less formal. Focus more on busy parents. Don't mention discounts." onValueChange={setNote} />
        </Field>
      </Modal>
    </div>
  );
}
