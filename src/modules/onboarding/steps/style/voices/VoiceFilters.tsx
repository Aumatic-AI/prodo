"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "../../../components/form/Field";
import { Select } from "@/components/kit/Select";
import { Pills, toggle } from "@/components/kit/choices";
import { Switch } from "@/components/kit/controls";
import { button, control, label } from "@/components/kit/styles";
import {
  ANY,
  VOICE_ACCENT_OPTIONS,
  VOICE_AGE_OPTIONS,
  VOICE_CATEGORY_OPTIONS,
  VOICE_GENDER_OPTIONS,
  VOICE_LANGUAGE_OPTIONS,
  VOICE_SORT_OPTIONS,
  VOICE_USE_CASE_OPTIONS,
} from "../../../config";
import type { VoiceFilterState } from "../../../hooks/useVoiceSearch";

interface FiltersProps {
  value: VoiceFilterState;
  onChange: (value: VoiceFilterState) => void;
}

/** Search box and sort, shown above the list. */
export function VoiceSearchBar({ value, onChange }: FiltersProps) {
  // Search waits until typing stops, so each key press isn't a request
  const [search, setSearch] = useState(value.search);
  useEffect(() => setSearch(value.search), [value.search]);
  useEffect(() => {
    if (search === value.search) return;
    const timer = setTimeout(() => onChange({ ...value, search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[220px] flex-[1_1_320px]">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ob-muted" aria-hidden="true" />
        <input
          className={cn(control, "pl-10")}
          aria-label="Search voices"
          placeholder="Search by name, style or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-none items-center gap-2">
        <span className="text-sm text-ob-muted">Sort by</span>
        <Select aria-label="Sort by" className="w-[200px]" options={VOICE_SORT_OPTIONS} value={value.sort} onValueChange={(sort) => onChange({ ...value, sort })} />
      </div>
    </div>
  );
}

const anyOf = (v: string) => v || ANY;
const fromAny = (v: string) => (v === ANY ? "" : v);

/** Dropdown filters, use-case chips and the featured switch, shown in the side panel. */
export function VoiceFilterPanel({ value, onChange, onReset }: FiltersProps & { onReset: () => void }) {
  const set = (patch: Partial<VoiceFilterState>) => onChange({ ...value, ...patch });
  const active = [value.language, value.accent, value.gender, value.age, value.category].filter(Boolean).length + value.useCases.length + Number(value.featured);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Filters{active > 0 && <span className="ml-1.5 text-ob-primary">({active})</span>}</span>
        {active > 0 && (
          <button type="button" className={button({ variant: "ghost", size: "sm" })} onClick={onReset}>
            <X size={14} />
            Clear all
          </button>
        )}
      </div>

      <Field label="Language" htmlFor="voice-language">
        <Select id="voice-language" searchable searchPlaceholder="Search languages…" options={VOICE_LANGUAGE_OPTIONS} value={anyOf(value.language)} onValueChange={(v) => set({ language: fromAny(v) })} />
      </Field>
      <Field label="Accent" htmlFor="voice-accent">
        <Select id="voice-accent" searchable searchPlaceholder="Search accents…" options={VOICE_ACCENT_OPTIONS} value={anyOf(value.accent)} onValueChange={(v) => set({ accent: fromAny(v) })} />
      </Field>
      <Field label="Gender" htmlFor="voice-gender">
        <Select id="voice-gender" options={VOICE_GENDER_OPTIONS} value={anyOf(value.gender)} onValueChange={(v) => set({ gender: fromAny(v) })} />
      </Field>
      <Field label="Age" htmlFor="voice-age">
        <Select id="voice-age" options={VOICE_AGE_OPTIONS} value={anyOf(value.age)} onValueChange={(v) => set({ age: fromAny(v) })} />
      </Field>
      <Field label="Quality" htmlFor="voice-quality">
        <Select id="voice-quality" options={VOICE_CATEGORY_OPTIONS} value={anyOf(value.category)} onValueChange={(v) => set({ category: fromAny(v) })} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className={label}>Use case</span>
        <Pills label="Use case" options={VOICE_USE_CASE_OPTIONS} value={value.useCases} onChange={(u) => set({ useCases: toggle(value.useCases, u) })} />
      </div>

      <Switch label="Featured voices only" checked={value.featured} onChange={(featured) => set({ featured })} />
    </div>
  );
}
