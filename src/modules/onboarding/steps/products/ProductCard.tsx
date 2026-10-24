"use client";

import type { ProductDraft } from "@/core/onboarding/schemas";
import { ItemCard } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { NumberInput, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { Switch } from "@/components/kit/controls";
import { TagInput } from "@/components/kit/TagInput";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOL } from "../../config";
import { row } from "@/components/kit/styles";

interface ProductCardProps {
  index: number;
  product: ProductDraft;
  canRemove: boolean;
}

export function ProductCard({ index, product: p, canRemove }: ProductCardProps) {
  const { updateItem, removeItem } = useSlice("products");
  const set = (patch: Partial<ProductDraft>) => updateItem("products", "products", index, patch);
  const path = (field: string) => `products.${index}.${field}`;
  const id = (field: string) => `product-${p.id}-${field}`;

  return (
    <ItemCard
      index={index}
      title={p.name || `Product ${index + 1}`}
      pathPrefix={`products.${index}`}
      onRemove={canRemove ? () => removeItem("products", "products", index) : undefined}
      aside={<Switch label="Hero product" checked={p.isHero} onChange={(isHero) => set({ isHero })} />}
    >
      <div className={row}>
        <Field label="Product name" htmlFor={id("name")} path={path("name")}>
          <TextInput id={id("name")} value={p.name} onValueChange={(name) => set({ name })} placeholder="e.g. Grey Stone wall panel" />
        </Field>
        <Field label="Price" htmlFor={id("price")} path={path("price")} optional>
          <div className="flex items-center gap-2.5">
            <NumberInput
              id={id("price")}
              min={0}
              step="0.01"
              prefix={CURRENCY_SYMBOL[p.currency] ?? ""}
              value={p.price}
              onValueChange={(price) => set({ price })}
              placeholder="0.00"
            />
            <Select aria-label="Currency" className="w-24 shrink-0" options={CURRENCY_OPTIONS} value={p.currency} onValueChange={(currency) => set({ currency })} />
          </div>
        </Field>
      </div>

      <Field label="Product link" htmlFor={id("url")} path={path("url")} optional>
        <TextInput id={id("url")} type="url" inputMode="url" value={p.url} onValueChange={(url) => set({ url })} placeholder="https://yourstore.com/product" />
      </Field>

      <Field
        label={p.isHero ? "Real photos (2–5)" : "Real photos"}
        path={path("photos")}
        optional={!p.isHero}
        hint={p.isHero ? "Hero products get featured most. Real photos make your actual product appear in ads." : "Used as reference images, so your real product appears in ads."}
      >
        <MediaUploader purpose="photo" max={5} value={p.photos} onChange={(photos) => set({ photos })} />
      </Field>

      <div className={row}>
        <Field label="Key benefits" htmlFor={id("benefits")} path={path("benefits")} optional>
          <TagInput id={id("benefits")} value={p.benefits} onChange={(benefits) => set({ benefits })} placeholder="e.g. Waterproof — press Enter" max={10} />
        </Field>
        <Field label="Main objections" htmlFor={id("objections")} path={path("objections")} optional>
          <TagInput id={id("objections")} value={p.objections} onChange={(objections) => set({ objections })} placeholder="e.g. Too expensive — press Enter" max={10} />
        </Field>
      </div>

      <Field label="Who it's for" htmlFor={id("audience")} path={path("audience")} optional>
        <TextInput id={id("audience")} value={p.audience} onValueChange={(audience) => set({ audience })} placeholder="e.g. Homeowners renovating on a budget" />
      </Field>
    </ItemCard>
  );
}
