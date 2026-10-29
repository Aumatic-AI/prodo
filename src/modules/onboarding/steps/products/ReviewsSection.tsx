"use client";

import { AddButton, FromSiteBadge, ItemCard } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { newReview } from "../../lib/factories";
import { row } from "@/components/kit/styles";

const GENERAL = "__general__";

export function ReviewsSection() {
  const { value, addItem, updateItem, removeItem } = useSlice("products");
  const aboutOptions = [
    { value: GENERAL, label: "The business in general" },
    ...value.products.map((p, i) => ({ value: p.id, label: p.name || `Product ${i + 1}` })),
  ];

  return (
    <>
      {value.reviews.map((r, i) => {
        const set = (patch: Partial<typeof r>) => updateItem("products", "reviews", i, patch);
        const path = (f: string) => `reviews.${i}.${f}`;
        return (
          <ItemCard
            key={r.id}
            index={i}
            title={r.author || `Review ${i + 1}`}
            pathPrefix={`reviews.${i}`}
            onRemove={() => removeItem("products", "reviews", i)}
            aside={r.found ? <FromSiteBadge>Found on your website</FromSiteBadge> : undefined}
          >
            <Field label="What the customer said" htmlFor={`review-${r.id}`} path={path("content")}>
              <TextArea id={`review-${r.id}`} value={r.content} onValueChange={(content) => set({ content })} placeholder="Paste the review exactly as written" />
            </Field>
            <div className={row}>
              <Field label="Customer name or initials" htmlFor={`review-${r.id}-author`} path={path("author")} optional>
                <TextInput id={`review-${r.id}-author`} value={r.author} onValueChange={(author) => set({ author })} placeholder="e.g. Maria C." />
              </Field>
              <Field label="About" htmlFor={`review-${r.id}-about`} path={path("offeringId")}>
                <Select
                  id={`review-${r.id}-about`}
                  options={aboutOptions}
                  value={r.offeringId ?? GENERAL}
                  onValueChange={(v) => set({ offeringId: v === GENERAL ? null : v })}
                />
              </Field>
            </div>
            {r.found ? (
              // Found reviews keep the page they were quoted from
              <p className="m-0 text-[13px] text-ob-muted">
                Quoted word for word from{" "}
                <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="break-all font-semibold text-ob-primary underline-offset-2 hover:underline">
                  {r.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </p>
            ) : (
              <Field label="Source link" htmlFor={`review-${r.id}-src`} path={path("sourceUrl")} optional hint="Where the review is published, e.g. Google or Facebook.">
                <TextInput id={`review-${r.id}-src`} type="url" inputMode="url" value={r.sourceUrl} onValueChange={(sourceUrl) => set({ sourceUrl })} placeholder="https://" />
              </Field>
            )}
          </ItemCard>
        );
      })}
      <AddButton onClick={() => addItem("products", "reviews", newReview())}>Add review</AddButton>
    </>
  );
}
