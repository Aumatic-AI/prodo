"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { ProductDraft } from "@/core/onboarding/schemas";
import { FromSiteBadge, ItemCard } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { NumberInput, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { Switch } from "@/components/kit/controls";
import { TagInput } from "@/components/kit/TagInput";
import { MediaUploader, publicUrl } from "@/components/kit/MediaUploader";
import { useHasErrorUnder, useSlice } from "../../store/OnboardingStoreProvider";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOL } from "../../config";
import { money } from "../review/format";
import { LIMITS } from "@/config/limits";
import { button, row } from "@/components/kit/styles";

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
  const hasError = useHasErrorUnder(`products.${index}`);
  // Products found on the website start folded, so a long list stays easy to check
  const [open, setOpen] = useState(!p.found);
  const expanded = open || hasError;

  return (
    <ItemCard
      index={index}
      title={p.name || `Product ${index + 1}`}
      pathPrefix={`products.${index}`}
      onRemove={canRemove ? () => removeItem("products", "products", index) : undefined}
      aside={
        <>
          {p.found && <FromSiteBadge>Found on your website</FromSiteBadge>}
          <Switch label="Hero product" checked={p.isHero} onChange={(isHero) => set({ isHero })} />
        </>
      }
    >
      {!expanded ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="size-16 shrink-0 overflow-hidden rounded-ob border border-ob-line bg-ob-sunken">
            {p.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicUrl(p.photos[0].key)} alt="" className="size-full object-cover" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ob-muted">
            <strong className="text-ob-ink">{money(p.price, p.currency) || "No price"}</strong>
            <span>{p.photos.length} {p.photos.length === 1 ? "photo" : "photos"}</span>
            <span>{p.benefits.length} {p.benefits.length === 1 ? "benefit" : "benefits"}</span>
          </span>
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setOpen(true)}>
            <Pencil size={14} />
            Check details
          </button>
        </div>
      ) : (
        <>
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
            label={p.isHero ? `Real photos (2–${LIMITS.offeringPhotosMax})` : "Real photos"}
            path={path("photos")}
            optional={!p.isHero}
            hint={p.isHero ? "Hero products get featured most. Real photos make your actual product appear in ads." : "Used as reference images, so your real product appears in ads."}
          >
            <MediaUploader purpose="photo" max={LIMITS.offeringPhotosMax} value={p.photos} onChange={(photos) => set({ photos })} />
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

          {p.found && (
            <button type="button" className={`${button({ variant: "secondary", size: "sm" })} self-start`} onClick={() => setOpen(false)}>
              Done
            </button>
          )}
        </>
      )}
    </ItemCard>
  );
}
