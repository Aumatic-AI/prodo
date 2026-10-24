"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { Field } from "@/components/kit/Field";
import { NumberInput, TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { TagInput } from "@/components/kit/TagInput";
import { button } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { FUNNEL_STAGES, OFFER_ROLES, bibleContentSchema, type BibleContent, type BiblePersona, type BiblePillar, type Claim } from "@/core/brand/bible";
import { CLIENT_EDIT } from "@/core/brand/sources";

// Edits keep each statement's sources and add "written by you"; new statements are the client's own.

const edited = (claim: Claim, text: string): Claim => ({ text, sources: [...new Set([...claim.sources, CLIENT_EDIT])] });
const newClaim = (): Claim => ({ text: "", sources: [CLIENT_EDIT] });
const ROLE_OPTIONS = OFFER_ROLES.map((r) => ({ value: r, label: r === "entry" ? "Entry offer" : r[0].toUpperCase() + r.slice(1) }));
const STAGE_OPTIONS = FUNNEL_STAGES.map((s) => ({ value: s, label: s === "tofu" ? "Reach new people" : s === "mofu" ? "Build trust" : "Drive sales" }));

function ClaimArea({ label, claim, onChange, rows = 3 }: { label?: string; claim: Claim; onChange: (c: Claim) => void; rows?: number }) {
  return (
    <Field label={label}>
      <TextArea rows={rows} value={claim.text} onValueChange={(text) => onChange(edited(claim, text))} />
    </Field>
  );
}

function ClaimListEditor({ claims, onChange, addLabel }: { claims: Claim[]; onChange: (c: Claim[]) => void; addLabel: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {claims.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput aria-label={`Item ${i + 1}`} value={c.text} onValueChange={(text) => onChange(claims.map((x, j) => (j === i ? edited(x, text) : x)))} />
          <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label="Remove" onClick={() => onChange(claims.filter((_, j) => j !== i))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button type="button" className={cn(button({ variant: "ghost", size: "sm" }), "self-start")} onClick={() => onChange([...claims, newClaim()])}>
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

const emptyPersona = (): BiblePersona => ({ name: "", summary: "", pains: [], desires: [], objections: [], triggers: [], phrases: [], sources: [CLIENT_EDIT] });
const emptyPillar = (): BiblePillar => ({ name: "", description: "", share: 0.2, funnelStage: null, examples: [] });

interface BibleEditorProps {
  initial: BibleContent;
  saving: boolean;
  onCancel: () => void;
  onSave: (content: BibleContent) => void;
}

/** Edits a whole Bible. Saving makes a new draft version. */
export function BibleEditor({ initial, saving, onCancel, onSave }: BibleEditorProps) {
  const [c, setC] = useState<BibleContent>(() => structuredClone(initial));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<BibleContent>) => setC((prev) => ({ ...prev, ...patch }));

  function save() {
    const total = c.pillars.reduce((sum, p) => sum + p.share, 0) || 1;
    const filled = (list: Claim[]) => list.filter((t) => t.text.trim());
    const content = {
      ...c,
      pillars: c.pillars.map((p) => ({ ...p, share: Math.round((p.share / total) * 1000) / 1000 })),
      tone_guide: { ...c.tone_guide, traits: filled(c.tone_guide.traits) },
      visual_rules: filled(c.visual_rules),
      do_dont: { do: filled(c.do_dont.do), dont: filled(c.do_dont.dont) },
    };
    const parsed = bibleContentSchema.safeParse(content);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`Check ${issue.path.join(" → ")}: ${issue.message}`);
      return;
    }
    setError(null);
    onSave(parsed.data);
  }

  const updatePersona = (i: number, patch: Partial<BiblePersona>) =>
    set({ personas: c.personas.map((x, j) => (j === i ? { ...x, ...patch, sources: [...new Set([...x.sources, CLIENT_EDIT])] } : x)) });
  const updatePillar = (i: number, patch: Partial<BiblePillar>) => set({ pillars: c.pillars.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="flex flex-col gap-5">
      <Card title="Positioning and promise">
        <div className="flex flex-col gap-4">
          <ClaimArea label="Positioning" claim={c.positioning} onChange={(positioning) => set({ positioning })} />
          <ClaimArea label="Value proposition" claim={c.value_prop} onChange={(value_prop) => set({ value_prop })} />
        </div>
      </Card>

      <Card title="Tone of voice">
        <div className="flex flex-col gap-4">
          <ClaimArea label="Summary" claim={c.tone_guide.summary} onChange={(summary) => set({ tone_guide: { ...c.tone_guide, summary } })} rows={2} />
          <Field label="Traits">
            <ClaimListEditor claims={c.tone_guide.traits} addLabel="Add trait" onChange={(traits) => set({ tone_guide: { ...c.tone_guide, traits } })} />
          </Field>
          <Field label="Example sentences" hint="Press Enter after each one">
            <TagInput value={c.tone_guide.examples} max={6} onChange={(examples) => set({ tone_guide: { ...c.tone_guide, examples } })} />
          </Field>
        </div>
      </Card>

      <Card title="Offer stack">
        {c.offer_stack.length ? (
          <div className="flex flex-col gap-4">
            {c.offer_stack.map((o, i) => (
              <div key={i} className="grid grid-cols-1 items-end gap-3 rounded-ob-md border border-ob-line p-4 md:grid-cols-[minmax(0,1fr)_200px_auto]">
                <ClaimArea label={o.name} rows={2} claim={o.pitch} onChange={(pitch) => set({ offer_stack: c.offer_stack.map((x, j) => (j === i ? { ...x, pitch } : x)) })} />
                <Field label="Role">
                  <Select options={ROLE_OPTIONS} value={o.role} onValueChange={(role) => set({ offer_stack: c.offer_stack.map((x, j) => (j === i ? { ...x, role: role as typeof o.role } : x)) })} />
                </Field>
                <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label="Remove from stack" onClick={() => set({ offer_stack: c.offer_stack.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-ob-muted">Add offerings in Brand → Offerings; the next draft includes them.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Do">
          <ClaimListEditor claims={c.do_dont.do} addLabel="Add" onChange={(list) => set({ do_dont: { ...c.do_dont, do: list } })} />
        </Card>
        <Card title="Don't">
          <ClaimListEditor claims={c.do_dont.dont} addLabel="Add" onChange={(list) => set({ do_dont: { ...c.do_dont, dont: list } })} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Never say">
          <TagInput value={c.never_say} max={80} placeholder="Type a word and press Enter" onChange={(never_say) => set({ never_say })} />
        </Card>
        <Card title="Visual rules">
          <ClaimListEditor claims={c.visual_rules} addLabel="Add rule" onChange={(visual_rules) => set({ visual_rules })} />
        </Card>
      </div>

      <Card title="Customer personas" description="3 or 4 work best.">
        <div className="flex flex-col gap-4">
          {c.personas.map((p, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-ob-md border border-ob-line p-4">
              <div className="flex items-end gap-2">
                <Field label="Name" className="flex-1">
                  <TextInput value={p.name} onValueChange={(name) => updatePersona(i, { name })} />
                </Field>
                <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label="Remove persona" onClick={() => set({ personas: c.personas.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} />
                </button>
              </div>
              <Field label="Summary">
                <TextArea rows={2} value={p.summary} onValueChange={(summary) => updatePersona(i, { summary })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Pains">
                  <TagInput value={p.pains} max={8} onChange={(pains) => updatePersona(i, { pains })} />
                </Field>
                <Field label="Wants">
                  <TagInput value={p.desires} max={8} onChange={(desires) => updatePersona(i, { desires })} />
                </Field>
                <Field label="Objections">
                  <TagInput value={p.objections} max={8} onChange={(objections) => updatePersona(i, { objections })} />
                </Field>
                <Field label="Things they say">
                  <TagInput value={p.phrases} max={8} onChange={(phrases) => updatePersona(i, { phrases })} />
                </Field>
              </div>
            </div>
          ))}
          {c.personas.length < 4 && (
            <button type="button" className={cn(button({ variant: "secondary", size: "sm" }), "self-start")} onClick={() => set({ personas: [...c.personas, emptyPersona()] })}>
              <Plus size={15} /> Add persona
            </button>
          )}
        </div>
      </Card>

      <Card title="Content pillars" description="Shares are rescaled to add up to 100%.">
        <div className="flex flex-col gap-4">
          {c.pillars.map((p, i) => (
            <div key={i} className="grid grid-cols-1 items-end gap-3 rounded-ob-md border border-ob-line p-4 md:grid-cols-[minmax(0,1fr)_120px_200px_auto]">
              <Field label="Pillar">
                <TextInput value={p.name} onValueChange={(name) => updatePillar(i, { name })} />
              </Field>
              <Field label="Share %">
                <NumberInput min={0} max={100} value={Math.round(p.share * 100)} onValueChange={(v) => updatePillar(i, { share: (v ?? 0) / 100 })} />
              </Field>
              <Field label="Goal">
                <Select options={STAGE_OPTIONS} value={p.funnelStage} placeholder="Pick a goal" onValueChange={(v) => updatePillar(i, { funnelStage: v as BiblePillar["funnelStage"] })} />
              </Field>
              <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label="Remove pillar" onClick={() => set({ pillars: c.pillars.filter((_, j) => j !== i) })}>
                <Trash2 size={16} />
              </button>
              <Field label="What posts in it are about" className="md:col-span-4">
                <TextInput value={p.description} onValueChange={(description) => updatePillar(i, { description })} />
              </Field>
            </div>
          ))}
          {c.pillars.length < 5 && (
            <button type="button" className={cn(button({ variant: "secondary", size: "sm" }), "self-start")} onClick={() => set({ pillars: [...c.pillars, emptyPillar()] })}>
              <Plus size={15} /> Add pillar
            </button>
          )}
        </div>
      </Card>

      <div className="sticky bottom-5 z-20 flex flex-wrap items-center justify-end gap-3 rounded-ob-lg border border-ob-line bg-ob-surface/95 px-5 py-3.5 shadow-ob-md backdrop-blur">
        {error && <p className="m-0 mr-auto text-sm font-medium text-ob-danger">{error}</p>}
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={button({ size: "sm" })} onClick={save} disabled={saving}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save as new version
        </button>
      </div>
    </div>
  );
}
