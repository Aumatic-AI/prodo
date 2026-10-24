"use client";

import type { ServiceDraft } from "@/core/onboarding/schemas";
import { ItemCard, NumberedList } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { NumberInput, TextArea, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOL, PRICE_MODEL_OPTIONS } from "../../config";
import { row } from "@/components/kit/styles";

interface ServiceCardProps {
  index: number;
  service: ServiceDraft;
  canRemove: boolean;
}

export function ServiceCard({ index, service: s, canRemove }: ServiceCardProps) {
  const { updateItem, removeItem } = useSlice("services");
  const set = (patch: Partial<ServiceDraft>) => updateItem("services", "services", index, patch);
  const path = (field: string) => `services.${index}.${field}`;
  const id = (field: string) => `service-${s.id}-${field}`;

  return (
    <ItemCard
      index={index}
      title={s.name || `Service ${index + 1}`}
      pathPrefix={`services.${index}`}
      onRemove={canRemove ? () => removeItem("services", "services", index) : undefined}
    >
      <Field label="Service name" htmlFor={id("name")} path={path("name")}>
        <TextInput id={id("name")} value={s.name} onValueChange={(name) => set({ name })} placeholder="e.g. Teeth whitening" />
      </Field>

      <div className={row}>
        <Field label="Pricing model" htmlFor={id("model")} path={path("priceModel")}>
          <Select id={id("model")} options={PRICE_MODEL_OPTIONS} value={s.priceModel} onValueChange={(v) => set({ priceModel: v as ServiceDraft["priceModel"] })} />
        </Field>
        {s.priceModel !== "quote" && (
          <Field label="Price" htmlFor={id("price")} path={path("price")} optional>
            <div className="flex items-center gap-2.5">
              <NumberInput
                id={id("price")}
                min={0}
                step="0.01"
                prefix={CURRENCY_SYMBOL[s.currency] ?? ""}
                value={s.price}
                onValueChange={(price) => set({ price })}
                placeholder="0.00"
              />
              <Select aria-label="Currency" className="w-24 shrink-0" options={CURRENCY_OPTIONS} value={s.currency} onValueChange={(currency) => set({ currency })} />
            </div>
          </Field>
        )}
      </div>

      <Field label="What's included" htmlFor={id("included")} path={path("included")} optional>
        <TextArea id={id("included")} rows={2} value={s.included} onValueChange={(included) => set({ included })} placeholder="e.g. Consultation, two sessions, aftercare kit" />
      </Field>

      <div className={row}>
        <Field label="Service link" htmlFor={id("url")} path={path("url")} optional>
          <TextInput id={id("url")} type="url" inputMode="url" value={s.url} onValueChange={(url) => set({ url })} placeholder="https://" />
        </Field>
        <Field label="Turnaround time" htmlFor={id("turnaround")} path={path("turnaround")} optional>
          <TextInput id={id("turnaround")} value={s.turnaround} onValueChange={(turnaround) => set({ turnaround })} placeholder="e.g. 2 weeks" />
        </Field>
      </div>

      <Field label="How it works" path={path("steps")} optional>
        <NumberedList
          label="Step"
          value={s.steps}
          onChange={(steps) => set({ steps })}
          max={8}
          addLabel="Add step"
          placeholder={(i) => ["e.g. Free consultation", "e.g. Treatment plan", "e.g. First session"][i] ?? "Next step"}
        />
      </Field>
    </ItemCard>
  );
}
