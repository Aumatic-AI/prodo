"use client";

import { Check, ExternalLink, SearchCheck, X } from "lucide-react";
import type { PendingFact, PendingKind } from "@/core/brand/pending";
import { button } from "@/components/kit/styles";
import { useDecidePending, usePendingFacts } from "../../hooks/useBible";

const GROUPS: { kind: PendingKind; title: string }[] = [
  { kind: "offering", title: "Products and services" },
  { kind: "offer", title: "Offers and deals" },
  { kind: "proof", title: "Reviews and proof" },
];

/**
 * Facts the Website Analyst found, waiting for a yes or no. Content agents only use confirmed ones.
 * Renders nothing when there's nothing to confirm.
 */
export function PendingFacts() {
  const { data: pending } = usePendingFacts();
  const decide = useDecidePending();
  if (!pending?.length) return null;

  const act = (items: PendingFact[], accept: boolean) => decide.mutate({ items: items.map(({ kind, id }) => ({ kind, id })), accept });

  return (
    <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-warn/40 bg-ob-warn-soft p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ob-surface text-ob-warn">
            <SearchCheck size={19} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-[17px] font-bold tracking-tight">Found on your website · {pending.length} to confirm</h2>
            <p className="m-0 text-sm text-ob-ink-soft">Agents only use what you confirm. Wrong or outdated? Reject it.</p>
          </div>
        </div>
        <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={decide.isPending} onClick={() => act(pending, true)}>
          <Check size={15} /> Confirm all
        </button>
      </div>
      {decide.error && <p className="m-0 text-sm font-medium text-ob-danger">{decide.error.message}</p>}

      {GROUPS.map(({ kind, title }) => {
        const items = pending.filter((p) => p.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-ob-muted">{title}</span>
            <ul className="m-0 flex list-none flex-col divide-y divide-ob-line overflow-hidden rounded-ob-md border border-ob-line bg-ob-surface p-0">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="m-0 line-clamp-2 text-sm font-semibold text-ob-ink">{item.title}</p>
                    <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-ob-muted">
                      {item.detail && <span className="line-clamp-1">{item.detail}</span>}
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-ob-primary hover:underline">
                          Source <ExternalLink size={12} />
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className={button({ variant: "secondary", size: "xs" })} disabled={decide.isPending} onClick={() => act([item], true)}>
                      <Check size={14} /> Confirm
                    </button>
                    <button type="button" className={button({ variant: "danger", size: "xs" })} disabled={decide.isPending} onClick={() => act([item], false)}>
                      <X size={14} /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
