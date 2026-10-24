"use client";

import { X } from "lucide-react";
import { AddButton } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { newCompetitor } from "../../lib/factories";
import { button } from "@/components/kit/styles";

const MAX_COMPETITORS = 5;

export function CompetitorsSection() {
  const { value, update, addItem, updateItem, removeItem } = useSlice("style");

  return (
    <>
      {value.competitors.map((c, i) => {
        const set = (patch: Partial<typeof c>) => updateItem("style", "competitors", i, patch);
        return (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-end gap-2.5">
            <Field label={i === 0 ? "Name" : undefined} path={`competitors.${i}.name`}>
              <TextInput aria-label={`Competitor ${i + 1} name`} value={c.name} onValueChange={(name) => set({ name })} placeholder="Competitor name" />
            </Field>
            <Field label={i === 0 ? "Website or Instagram" : undefined} path={`competitors.${i}.link`}>
              <TextInput aria-label={`Competitor ${i + 1} link`} value={c.link} onValueChange={(link) => set({ link })} placeholder="https:// or @handle" />
            </Field>
            <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label={`Remove ${c.name || "competitor"}`} onClick={() => removeItem("style", "competitors", i)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
      {value.competitors.length < MAX_COMPETITORS && <AddButton onClick={() => addItem("style", "competitors", newCompetitor())}>Add competitor</AddButton>}

      <Field label="Competitor videos you like or want to beat" path="competitorVideos" optional hint="Up to 4 videos. We study their hook and pacing.">
        <MediaUploader purpose="video" max={4} value={value.competitorVideos} onChange={(competitorVideos) => update("style", { competitorVideos })} />
      </Field>
    </>
  );
}
