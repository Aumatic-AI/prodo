"use client";

import { useState } from "react";
import { useMakeAd } from "../../hooks/useMedia";
import { FormFooter } from "./FormFooter";
import { IdeaField } from "./IdeaField";
import { NO_PRODUCT, ProductPicker, productFields } from "./ProductPicker";
import { StyleField } from "./StyleField";

/** An image ad, made by the same chain as the ones in This week: Creative Director, QA, Producer, QA. */
export function ImageTab({ onDone }: { onDone: () => void }) {
  const [idea, setIdea] = useState("");
  const [product, setProduct] = useState(NO_PRODUCT);
  const [style, setStyle] = useState<string | null>(null);
  const make = useMakeAd();

  async function submit() {
    const { offering_id, product_name } = productFields(product);
    await make.mutateAsync({ format: "static", idea: product_name ? `${idea.trim()} (about: ${product_name})` : idea.trim(), offeringId: offering_id, style });
    onDone();
  }

  return (
    <div className="flex flex-col gap-6">
      <IdeaField value={idea} onChange={setIdea} format="image" placeholder="e.g. Our iced latte on a sunny café table, morning light, fresh and inviting" />
      <ProductPicker value={product} onChange={setProduct} />
      <StyleField format="static" value={style} onChange={setStyle} />
      <FormFooter
        note="Made from your brand, photos and content settings. Ready in 2–4 minutes; it shows here and in This week."
        label="Create image"
        busy={make.isPending}
        disabled={idea.trim().length < 3}
        error={make.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
