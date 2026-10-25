"use client";

import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { useOfferings } from "@/modules/settings/hooks/useOfferings";
import { OTHER_PRODUCT } from "./options";

export interface ProductChoice {
  /** An offering id, OTHER_PRODUCT, or "" for none */
  selected: string;
  custom: string;
}

export const NO_PRODUCT: ProductChoice = { selected: "", custom: "" };

/** What the API takes: a saved offering by id, or "Other" as free text. */
export function productFields(choice: ProductChoice): { offering_id?: string; product_name?: string } {
  if (choice.selected === OTHER_PRODUCT) return { product_name: choice.custom.trim() || undefined };
  return { offering_id: choice.selected || undefined };
}

export function hasProduct(choice: ProductChoice): boolean {
  const f = productFields(choice);
  return !!(f.offering_id || f.product_name);
}

interface ProductPickerProps {
  value: ProductChoice;
  onChange: (value: ProductChoice) => void;
  required?: boolean;
}

/** Offering picker from Brand → Offerings, with "Other" for a typed name. */
export function ProductPicker({ value, onChange, required }: ProductPickerProps) {
  const { data: offerings } = useOfferings();
  const options = [
    ...(required ? [] : [{ value: "", label: "No product" }]),
    ...(offerings ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.kind === "service" ? "Service" : "Product" })),
    { value: OTHER_PRODUCT, label: "Other…" },
  ];

  return (
    <Field label="Product or service" htmlFor="product" optional={!required} hint="Ads use its real details and photos.">
      <Select
        id="product"
        searchable={options.length > 8}
        value={value.selected || (required ? null : "")}
        onValueChange={(selected) => onChange({ selected, custom: selected === OTHER_PRODUCT ? value.custom : "" })}
        options={options}
        placeholder="Pick what this is about"
      />
      {value.selected === OTHER_PRODUCT && (
        <TextInput aria-label="Product or service name" placeholder="Type the product or service name" value={value.custom} onValueChange={(custom) => onChange({ ...value, custom })} />
      )}
    </Field>
  );
}
