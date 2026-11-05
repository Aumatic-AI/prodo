"use client";

import { useState } from "react";
import { useMakeAd } from "../../hooks/useMedia";
import { FormFooter } from "./FormFooter";
import { IdeaField } from "./IdeaField";
import { NO_PRODUCT, ProductPicker, hasProduct, productFields } from "./ProductPicker";
import { StyleField } from "./StyleField";

/** A video ad, made by the same chain as the ones in This week: Creative Director, QA, Producer, QA. */
export function VideoTab({ onDone }: { onDone: () => void }) {
  const [idea, setIdea] = useState("");
  const [product, setProduct] = useState(NO_PRODUCT);
  const [style, setStyle] = useState<string | null>(null);
  const make = useMakeAd();

  async function submit() {
    const { offering_id, product_name } = productFields(product);
    await make.mutateAsync({ format: "video", idea: product_name ? `${idea.trim()} (about: ${product_name})` : idea.trim(), offeringId: offering_id, style });
    onDone();
  }

  const missing = idea.trim().length < 3 ? "Add your idea" : !hasProduct(product) ? "Pick a product or service" : null;

  return (
    <div className="flex flex-col gap-6">
      <IdeaField value={idea} onChange={setIdea} format="video" placeholder="e.g. A quick before-and-after showing how our cleaning service transforms a messy kitchen" />
      <ProductPicker value={product} onChange={setProduct} required />
      <StyleField format="video" value={style} onChange={setStyle} />
      <FormFooter
        note={missing ?? "The voice, music, length and look come from your content settings. About 10 minutes; it shows here and in This week."}
        label="Create video"
        busy={make.isPending}
        disabled={!!missing}
        error={make.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
