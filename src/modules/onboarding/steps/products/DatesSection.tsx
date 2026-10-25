"use client";

import { X } from "lucide-react";
import { AddButton } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { DatePicker } from "@/components/kit/DatePicker";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { DATE_KIND_OPTIONS } from "../../config";
import { newDate } from "../../lib/factories";
import { button } from "@/components/kit/styles";

/** Compact rows: event, kind, date. */
export function DatesSection() {
  const { value, addItem, updateItem, removeItem } = useSlice("products");

  return (
    <>
      {value.dates.map((d, i) => {
        const set = (patch: Partial<typeof d>) => updateItem("products", "dates", i, patch);
        return (
          <div key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 sm:grid-cols-[minmax(0,1fr)_140px_170px_auto]">
            <Field path={`dates.${i}.name`}>
              <TextInput aria-label={`Event ${i + 1}`} value={d.name} onValueChange={(name) => set({ name })} placeholder="e.g. Summer sale" />
            </Field>
            <Field path={`dates.${i}.kind`}>
              <Select aria-label="Kind" options={DATE_KIND_OPTIONS} value={d.kind} onValueChange={(kind) => set({ kind: kind as typeof d.kind })} />
            </Field>
            <Field path={`dates.${i}.date`}>
              <DatePicker aria-label="Date" value={d.date} onChange={(date) => set({ date })} />
            </Field>
            <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label={`Remove ${d.name || "date"}`} onClick={() => removeItem("products", "dates", i)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
      <AddButton onClick={() => addItem("products", "dates", newDate())}>Add date</AddButton>
    </>
  );
}
