"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { button, focusRing } from "@/components/kit/styles";
import { TextInput } from "@/components/kit/inputs";
import { AddButton } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { RELATION_OPTIONS } from "./labels";

const MAX_BRANDS = 6;

const newBrand = () => ({ id: crypto.randomUUID(), name: "", link: "", relation: "competitor" as const });

/** Competitors and brands to take inspiration from: name, link and why. */
export function BrandsSection() {
  const { value, addItem, updateItem, removeItem } = useSlice("content");

  return (
    <>
      {value.brands.map((b, i) => {
        const set = (patch: Partial<typeof b>) => updateItem("content", "brands", i, patch);
        return (
          <div key={b.id} className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]">
            <Field label={i === 0 ? "Name" : undefined} path={`brands.${i}.name`}>
              <TextInput aria-label={`Brand ${i + 1} name`} value={b.name} onValueChange={(name) => set({ name })} placeholder="Brand name" />
            </Field>
            <Field label={i === 0 ? "Website or Instagram" : undefined} path={`brands.${i}.link`}>
              <TextInput aria-label={`Brand ${i + 1} link`} value={b.link} onValueChange={(link) => set({ link })} placeholder="https:// or @handle" />
            </Field>
            <Field label={i === 0 ? "Why" : undefined}>
              <div role="group" aria-label={`Why ${b.name || `brand ${i + 1}`}`} className="inline-flex min-h-11 gap-1 rounded-ob border border-ob-line bg-ob-sunken p-1">
                {RELATION_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={b.relation === o.value}
                    onClick={() => set({ relation: o.value })}
                    className={cn(
                      "rounded-[7px] px-3 text-[13px] font-bold transition-colors",
                      focusRing,
                      b.relation === o.value ? "bg-ob-surface text-ob-ink shadow-ob-xs" : "text-ob-muted hover:text-ob-ink"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <button
              type="button"
              className={cn(button({ variant: "danger", size: "icon" }), "mb-0.5")}
              aria-label={`Remove ${b.name || "brand"}`}
              onClick={() => removeItem("content", "brands", i)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      {value.brands.length < MAX_BRANDS && <AddButton onClick={() => addItem("content", "brands", newBrand())}>Add a brand</AddButton>}
    </>
  );
}
