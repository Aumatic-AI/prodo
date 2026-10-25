"use client";

import { Check, FlaskConical, Quote, X } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { TextArea } from "@/components/kit/inputs";
import { button } from "@/components/kit/styles";
import { platformMeta } from "@/config/platforms";
import { LABELS } from "@/core/creative/brief";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { useActivity, useSaveCaptions } from "../../hooks/usePlan";
import { ActivityList } from "../ActivityFeed";

const label = "text-[11.5px] font-bold uppercase tracking-[0.08em] text-ob-faint";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      <div className="text-[14px] leading-relaxed text-ob-ink">{children}</div>
    </div>
  );
}

export function WhyTab({ item }: { item: PlanItemView }) {
  return (
    <div className="flex flex-col gap-4">
      {item.rationale && (
        <div className="rounded-ob-md bg-ob-primary-soft px-4 py-3 text-[14px] leading-relaxed text-ob-primary-ink">
          <Quote size={14} className="mb-1 opacity-60" />
          {item.rationale}
        </div>
      )}
      <Row title="Angle">{item.angle}</Row>
      <Row title="Goal">{item.objective}</Row>
      <div className="grid grid-cols-2 gap-4">
        <Row title="Speaks to">{item.persona?.name ?? "Everyone"}</Row>
        <Row title="Pillar">{item.pillar?.name ?? "—"}</Row>
        <Row title="Promotes">{item.offering?.name ?? "The brand"}</Row>
        <Row title="Funnel">{{ tofu: "Reach new people", mofu: "Build trust", bofu: "Drive action" }[item.funnel_stage ?? "tofu"]}</Row>
      </div>
      {item.offer && <Row title="Offer">{item.offer.title}</Row>}
      {item.is_experiment && (
        <div className="flex items-center gap-2 text-[13px] text-ob-muted">
          <FlaskConical size={15} className="text-ob-primary" /> An experiment: Prodo is testing something new to learn what works for you.
        </div>
      )}
    </div>
  );
}

export function BriefTab({ item }: { item: PlanItemView }) {
  const b = item.brief;
  if (!b) return <p className="m-0 text-sm text-ob-muted">The Creative Director hasn&apos;t written the brief yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      <Row title={`Hook · ${LABELS.hook[b.hook.type]}`}>
        <span className="text-[16px] font-bold">{b.hook.text}</span>
      </Row>
      <Row title="One message">{b.message}</Row>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{LABELS.framework[b.framework]}</Badge>
        {b.levers.map((l) => (
          <Badge key={l.lever}>{LABELS.lever[l.lever]}</Badge>
        ))}
        <Badge tone="dark">CTA: {b.cta.label}</Badge>
      </div>
      {b.kind === "static" && (
        <Row title="On the image">
          <strong>{b.headline}</strong>
          {b.subhead && <span className="block text-ob-muted">{b.subhead}</span>}
          {b.badge && <span className="mt-1 inline-block rounded-full bg-ob-warn-soft px-2 py-0.5 text-xs font-bold text-ob-warn">{b.badge.text}</span>}
        </Row>
      )}
      {b.kind === "carousel" && (
        <Row title={`${b.slides.length} slides`}>
          <ol className="m-0 flex flex-col gap-1.5 pl-5">
            {b.slides.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong> {s.body && <span className="text-ob-muted">· {s.body}</span>}
              </li>
            ))}
          </ol>
        </Row>
      )}
      {b.kind === "video" && (
        <Row title={`${b.scenes.length} scenes`}>
          <ol className="m-0 flex flex-col gap-2 pl-5">
            {b.scenes.map((s, i) => (
              <li key={i}>
                {s.overlay && <strong className="block">{s.overlay}</strong>}
                <span className="text-ob-ink-soft">&ldquo;{s.voiceover}&rdquo;</span>
              </li>
            ))}
          </ol>
        </Row>
      )}
      {b.claims.length > 0 && (
        <Row title="Facts it uses">
          <ul className="m-0 flex flex-col gap-1 pl-5 text-[13.5px]">
            {b.claims.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
        </Row>
      )}
      {b.hookOptions.length > 0 && (
        <details className="rounded-ob-md bg-ob-sunken px-3.5 py-2.5 text-[13px]">
          <summary className="cursor-pointer font-semibold text-ob-muted">Other hooks it considered ({b.hookOptions.length})</summary>
          <ul className="mb-0 mt-2 flex flex-col gap-1 pl-5">
            {b.hookOptions.map((h, i) => (
              <li key={i}>
                {h.text} <span className="text-ob-faint">· {LABELS.hook[h.type]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CaptionsTab({ item, captions, setCaptions, editable }: { item: PlanItemView; captions: Record<string, string>; setCaptions: (c: Record<string, string>) => void; editable: boolean }) {
  const save = useSaveCaptions();
  const dirty = JSON.stringify(captions) !== JSON.stringify(item.captions ?? {});
  return (
    <div className="flex flex-col gap-4">
      {item.platforms.map((p) => {
        const meta = platformMeta(p);
        const text = captions[p] ?? "";
        const over = text.length > meta.captionMaxLength;
        return (
          <label key={p} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="text-sm font-semibold">{meta.label}</span>
              <span className={cn("text-xs tabular-nums", over ? "text-ob-danger" : "text-ob-faint")}>
                {text.length} / {meta.captionMaxLength}
              </span>
            </span>
            <TextArea rows={5} value={text} disabled={!editable} onValueChange={(v) => setCaptions({ ...captions, [p]: v })} />
          </label>
        );
      })}
      {editable && dirty && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" className={button({ variant: "quiet", size: "sm" })} onClick={() => setCaptions(item.captions ?? {})}>
            Undo
          </button>
          <button type="button" className={button({ size: "sm" })} disabled={save.isPending} onClick={() => save.mutate({ id: item.id, captions })}>
            Save captions
          </button>
        </div>
      )}
      {save.error && <p className="m-0 text-sm text-ob-danger">{save.error.message}</p>}
    </div>
  );
}

function ScoreBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[12.5px] text-ob-muted">{name}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ob-sunken">
        <div className={cn("h-full rounded-full", value >= 7 ? "bg-ob-success" : value >= 5 ? "bg-ob-warn" : "bg-ob-danger")} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="w-8 text-right text-[12.5px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

const SCORE_NAMES: Record<string, string> = { hook: "Hook", oneMessage: "One message", personaFit: "Persona fit", cta: "Call to action", proof: "Proof", compliance: "Compliance" };

export function QualityTab({ item }: { item: PlanItemView }) {
  const r = item.qa_report;
  if (!r?.gate1 && !r?.gate2) return <p className="m-0 text-sm text-ob-muted">Not checked yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      {r.reason && <div className="rounded-ob-md bg-ob-warn-soft px-4 py-3 text-sm text-ob-warn">{r.reason}</div>}
      {r.gate1 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className={label}>Gate 1 · the brief</span>
            <span className="text-sm font-bold">{r.gate1.score}/10</span>
          </div>
          {Object.entries(r.gate1.scores ?? {}).map(([k, v]) => (
            <ScoreBar key={k} name={SCORE_NAMES[k] ?? k} value={Number(v)} />
          ))}
          {r.gate1.notes && <p className="m-0 text-[13px] text-ob-muted">{r.gate1.notes}</p>}
          {r.gate1.attempts > 1 && <span className="text-xs text-ob-faint">Rewritten {r.gate1.attempts - 1}× before passing</span>}
        </div>
      )}
      {r.gate2 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className={label}>Gate 2 · the finished {item.format === "video" ? "video" : "design"}</span>
            <span className="text-sm font-bold">{r.gate2.score}/10</span>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
            {r.gate2.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-2 rounded-ob bg-ob-sunken px-3 py-2 text-[12.5px]">
                {c.passed ? <Check size={14} className="mt-0.5 shrink-0 text-ob-success" /> : <X size={14} className="mt-0.5 shrink-0 text-ob-danger" />}
                <span className="flex flex-col">
                  <strong className="font-semibold">{c.name}</strong>
                  {c.detail && <span className="text-ob-muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {r.gate2.notes && <p className="m-0 text-[13px] text-ob-muted">{r.gate2.notes}</p>}
        </div>
      )}
    </div>
  );
}

export function ActivityTab({ item, live }: { item: PlanItemView; live: boolean }) {
  const { data, isLoading } = useActivity({ itemId: item.id }, live);
  if (isLoading) return <p className="m-0 text-sm text-ob-muted">Loading…</p>;
  if (!data?.length) return <p className="m-0 text-sm text-ob-muted">No steps yet.</p>;
  const cost = data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-ob-muted">
        {data.length} steps · <strong className="text-ob-ink">${cost.toFixed(2)}</strong> in total
      </span>
      <ActivityList rows={data} />
    </div>
  );
}
