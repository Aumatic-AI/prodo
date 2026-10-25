"use client";

import { useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { Modal } from "@/components/kit/Modal";
import { Skeleton } from "@/components/kit/Skeleton";
import { Badge } from "@/components/kit/Badge";
import type { Claim } from "@/core/brand/bible";
import { cn } from "@/lib/utils";
import { useSources } from "../../hooks/useBible";

const KIND_LABEL = { passage: "Website or posts", answer: "Your answer", offering: "Offering", proof: "Proof", kit: "Brand kit", client: "You" } as const;

/** The passages and answers behind a statement. */
export function SourcesDialog({ refs, onClose }: { refs: string[] | null; onClose: () => void }) {
  const { data, isLoading, error } = useSources(refs);
  return (
    <Modal
      open={!!refs}
      onOpenChange={(open) => !open && onClose()}
      title="Where this comes from"
      description="Every statement in the Brand Bible is backed by at least one of these."
      className="w-[min(calc(100vw-32px),680px)]"
    >
      <div className="flex flex-col gap-3">
        {isLoading && <Skeleton className="h-28" />}
        {error && <p className="m-0 text-sm text-ob-danger">{error.message}</p>}
        {data?.length === 0 && <p className="m-0 text-sm text-ob-muted">The source was removed since this was written.</p>}
        {data?.map((s) => (
          <article key={s.ref} className="flex flex-col gap-2 rounded-ob-md border border-ob-line bg-ob-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={s.kind === "answer" || s.kind === "client" ? "primary" : "neutral"} size="sm">
                {KIND_LABEL[s.kind]}
              </Badge>
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ob-primary hover:underline">
                  Open page <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p className="m-0 text-[15px] font-bold text-ob-ink">{s.title}</p>
            <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-ob-ink-soft">{s.text}</p>
          </article>
        ))}
      </div>
    </Modal>
  );
}

/** A statement with a small button showing how many sources back it. */
export function ClaimText({ claim, onShowSources, className }: { claim: Claim; onShowSources: (refs: string[]) => void; className?: string }) {
  return (
    <p className={cn("m-0 text-[15px] leading-relaxed text-ob-ink", className)}>
      {claim.text}{" "}
      <button
        type="button"
        onClick={() => onShowSources(claim.sources)}
        className="inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full bg-ob-primary-soft px-1.5 py-px align-middle text-[11px] font-bold text-ob-primary transition-colors hover:bg-ob-primary hover:text-ob-on-primary"
        title="Show sources"
        aria-label={`Show ${claim.sources.length} source${claim.sources.length === 1 ? "" : "s"}`}
      >
        <Quote size={10} />
        {claim.sources.length}
      </button>
    </p>
  );
}

/** State for one sources dialog per page. */
export function useSourcesDialog() {
  const [refs, setRefs] = useState<string[] | null>(null);
  return { refs, show: setRefs, close: () => setRefs(null) };
}
