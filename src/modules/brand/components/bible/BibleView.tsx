"use client";

import { Ban, Check, Eye, MessageSquareQuote, Target, Users, X } from "lucide-react";
import type { BibleContent, Claim } from "@/core/brand/bible";
import { Badge } from "@/components/kit/Badge";
import { Card } from "@/components/kit/Card";
import { ClaimText } from "./Sources";

const ROLE_LABEL = { hero: "Hero", core: "Core", entry: "Entry offer", upsell: "Upsell" } as const;
const ROLE_TONE = { hero: "primary", core: "neutral", entry: "success", upsell: "neutral" } as const;
const STAGE = { tofu: ["Reach", "primary"], mofu: ["Trust", "success"], bofu: ["Sale", "warn"] } as const;

type ShowSources = (refs: string[]) => void;

function ClaimList({ claims, onShowSources, icon }: { claims: Claim[]; onShowSources: ShowSources; icon?: "do" | "dont" }) {
  if (!claims.length) return <p className="m-0 text-sm text-ob-faint">Nothing here yet</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {claims.map((c, i) => (
        <li key={i} className="flex gap-3">
          {icon === "do" ? (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ob-success-soft text-ob-success">
              <Check size={12} strokeWidth={3} />
            </span>
          ) : icon === "dont" ? (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ob-danger-soft text-ob-danger">
              <X size={12} strokeWidth={3} />
            </span>
          ) : (
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ob-primary" />
          )}
          <ClaimText claim={c} onShowSources={onShowSources} />
        </li>
      ))}
    </ul>
  );
}

/** The whole Brand Bible, read-only, with a sources button on every statement. */
export function BibleView({ content, onShowSources }: { content: BibleContent; onShowSources: ShowSources }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-5 rounded-ob-lg bg-ob-dark p-7 text-ob-on-dark">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ob-on-dark-soft">Positioning</span>
          <ClaimText claim={content.positioning} onShowSources={onShowSources} className="text-[22px] font-bold leading-snug tracking-tight text-ob-on-dark" />
        </div>
        <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ob-on-dark-soft">Value proposition</span>
          <ClaimText claim={content.value_prop} onShowSources={onShowSources} className="text-base text-ob-on-dark-soft" />
        </div>
      </section>

      <Card title="Tone of voice" actions={<MessageSquareQuote size={18} className="text-ob-faint" />}>
        <div className="flex flex-col gap-5">
          <ClaimText claim={content.tone_guide.summary} onShowSources={onShowSources} className="font-semibold" />
          <ClaimList claims={content.tone_guide.traits} onShowSources={onShowSources} />
          {content.tone_guide.examples.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-ob-muted">Sounds like</span>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {content.tone_guide.examples.map((e, i) => (
                  <p key={i} className="m-0 rounded-ob-md border-l-[3px] border-ob-primary bg-ob-primary-soft px-4 py-3 text-sm italic text-ob-ink">
                    &ldquo;{e}&rdquo;
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Offer stack" description="What to promote, and the role each offer plays.">
        {content.offer_stack.length === 0 ? (
          <p className="m-0 text-sm text-ob-faint">No offerings in the stack yet</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
            {content.offer_stack.map((o, i) => (
              <li key={i} className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[15px]">{o.name}</strong>
                  <Badge tone={ROLE_TONE[o.role]} size="sm">
                    {ROLE_LABEL[o.role]}
                  </Badge>
                  {o.pending && (
                    <Badge tone="warn" size="sm">
                      Confirm this offering
                    </Badge>
                  )}
                </div>
                <ClaimText claim={o.pitch} onShowSources={onShowSources} className="text-sm text-ob-muted" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Do">
          <ClaimList claims={content.do_dont.do} onShowSources={onShowSources} icon="do" />
        </Card>
        <Card title="Don't">
          <ClaimList claims={content.do_dont.dont} onShowSources={onShowSources} icon="dont" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Never say" description="No post may use these." actions={<Ban size={18} className="text-ob-faint" />}>
          {content.never_say.length ? (
            <div className="flex flex-wrap gap-2">
              {content.never_say.map((w, i) => (
                <span key={i} className="rounded-full border border-ob-danger/30 bg-ob-danger-soft px-3 py-1 text-[13px] font-semibold text-ob-danger line-through decoration-ob-danger/40">
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-ob-faint">None</p>
          )}
        </Card>
        <Card title="Visual rules" actions={<Eye size={18} className="text-ob-faint" />}>
          <ClaimList claims={content.visual_rules} onShowSources={onShowSources} />
        </Card>
      </div>

      <Card title="Customer personas" description="Each post speaks to one of them." actions={<Users size={18} className="text-ob-faint" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {content.personas.map((p, i) => (
            <article key={i} className="flex flex-col gap-3 rounded-ob-md border border-ob-line bg-ob-bg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ob-primary text-sm font-bold text-ob-on-primary">{p.name.charAt(0)}</span>
                  <strong className="text-[15px] leading-tight">{p.name}</strong>
                </div>
                <button type="button" onClick={() => onShowSources(p.sources)} className="shrink-0 text-xs font-semibold text-ob-primary hover:underline">
                  {p.sources.length} sources
                </button>
              </div>
              <p className="m-0 text-sm text-ob-muted">{p.summary}</p>
              {(
                [
                  ["Pains", p.pains],
                  ["Wants", p.desires],
                  ["Objections", p.objections],
                ] as const
              )
                .filter(([, list]) => list.length)
                .map(([label, list]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ob-faint">{label}</span>
                    <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4 text-[13.5px] text-ob-ink-soft">
                      {list.map((x, j) => (
                        <li key={j}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              {p.phrases.length > 0 && <p className="m-0 border-t border-ob-line pt-3 text-[13.5px] italic text-ob-ink-soft">&ldquo;{p.phrases[0]}&rdquo;</p>}
            </article>
          ))}
        </div>
      </Card>

      <Card title="Content pillars" description="Recurring themes and their share of the weekly plan." actions={<Target size={18} className="text-ob-faint" />}>
        <div className="flex flex-col gap-4">
          {content.pillars.map((p, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <strong className="text-[15px]">{p.name}</strong>
                  {p.funnelStage && (
                    <Badge tone={STAGE[p.funnelStage][1]} size="sm">
                      {STAGE[p.funnelStage][0]}
                    </Badge>
                  )}
                </span>
                <span className="text-sm font-bold tabular-nums">{Math.round(p.share * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ob-line">
                <div className="h-full rounded-full bg-ob-primary" style={{ width: `${p.share * 100}%` }} />
              </div>
              <p className="m-0 text-sm text-ob-muted">{p.description}</p>
              {p.examples.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.examples.map((x, j) => (
                    <span key={j} className="rounded-full border border-ob-line bg-ob-surface px-2.5 py-0.5 text-xs text-ob-ink-soft">
                      {x}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
