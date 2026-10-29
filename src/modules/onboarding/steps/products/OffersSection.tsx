"use client";

import { AddButton, FromSiteBadge, ItemCard } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { DatePicker } from "@/components/kit/DatePicker";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { newOffer } from "../../lib/factories";
import { row } from "@/components/kit/styles";

const ALL = "__all__";

export function OffersSection() {
  const { value, addItem, updateItem, removeItem } = useSlice("products");
  const productOptions = [
    { value: ALL, label: "All products" },
    ...value.products.map((p, i) => ({ value: p.id, label: p.name || `Product ${i + 1}` })),
  ];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {value.offers.map((o, i) => {
        const set = (patch: Partial<typeof o>) => updateItem("products", "offers", i, patch);
        const path = (f: string) => `offers.${i}.${f}`;
        return (
          <ItemCard
            key={o.id}
            index={i}
            title={o.title || `Offer ${i + 1}`}
            pathPrefix={`offers.${i}`}
            onRemove={() => removeItem("products", "offers", i)}
            aside={o.found ? <FromSiteBadge>Found on your website</FromSiteBadge> : undefined}
          >
            <Field label="What's the offer?" htmlFor={`offer-${o.id}`} path={path("title")}>
              <TextInput id={`offer-${o.id}`} value={o.title} onValueChange={(title) => set({ title })} placeholder="e.g. 20% off all wall panels" />
            </Field>
            <div className={row}>
              <Field label="Applies to" htmlFor={`offer-${o.id}-to`} path={path("offeringId")}>
                <Select
                  id={`offer-${o.id}-to`}
                  options={productOptions}
                  value={o.offeringId ?? ALL}
                  onValueChange={(v) => set({ offeringId: v === ALL ? null : v })}
                />
              </Field>
              <Field
                label="Ends on"
                htmlFor={`offer-${o.id}-ends`}
                path={path("endsAt")}
                optional
                hint={o.endsAt ? undefined : "Add the end date to use 'ends soon' copy for this offer."}
              >
                <DatePicker id={`offer-${o.id}-ends`} min={today} value={o.endsAt} onChange={(endsAt) => set({ endsAt })} placeholder="Pick the last day" />
              </Field>
            </div>
            <Field label="Details" htmlFor={`offer-${o.id}-details`} path={path("details")} optional>
              <TextInput id={`offer-${o.id}-details`} value={o.details} onValueChange={(details) => set({ details })} placeholder="e.g. Code SAVE20, minimum order €100" />
            </Field>
          </ItemCard>
        );
      })}
      <AddButton onClick={() => addItem("products", "offers", newOffer())}>Add offer</AddButton>
    </>
  );
}
