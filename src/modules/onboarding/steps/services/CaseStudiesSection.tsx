"use client";

import { AddButton, ItemCard } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { newCaseStudy } from "../../lib/factories";

export function CaseStudiesSection() {
  const { value, addItem, updateItem, removeItem } = useSlice("services");

  return (
    <>
      {value.caseStudies.map((c, i) => {
        const set = (patch: Partial<typeof c>) => updateItem("services", "caseStudies", i, patch);
        const path = (f: string) => `caseStudies.${i}.${f}`;
        return (
          <ItemCard key={c.id} index={i} title={c.client || `Case study ${i + 1}`} pathPrefix={`caseStudies.${i}`} onRemove={() => removeItem("services", "caseStudies", i)}>
            <Field label="Client or project" htmlFor={`case-${c.id}`} path={path("client")}>
              <TextInput id={`case-${c.id}`} value={c.client} onValueChange={(client) => set({ client })} placeholder="e.g. Seaside Café renovation" />
            </Field>
            <Field label="Result" htmlFor={`case-${c.id}-result`} path={path("result")}>
              <TextArea id={`case-${c.id}-result`} rows={2} value={c.result} onValueChange={(result) => set({ result })} placeholder="What changed, with numbers if you have them" />
            </Field>
            <Field label="Before / after photos" path={path("photos")} optional>
              <MediaUploader purpose="photo" max={4} value={c.photos} onChange={(photos) => set({ photos })} />
            </Field>
          </ItemCard>
        );
      })}
      <AddButton onClick={() => addItem("services", "caseStudies", newCaseStudy())}>Add case study</AddButton>
    </>
  );
}
