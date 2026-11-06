"use client";

import { useState } from "react";
import { Field } from "@/components/kit/Field";
import { TextArea, TextInput } from "@/components/kit/inputs";
import { MediaUploader } from "@/components/kit/MediaUploader";
import type { Upload } from "@/core/onboarding/schemas";
import { useMakeAd } from "../../hooks/useMedia";
import { FormFooter } from "./FormFooter";
import { NO_PRODUCT, ProductPicker, productFields } from "./ProductPicker";

/** A video the owner likes, made again with their product: everything but the product comes from the video. */
export function CopyTab({ onDone }: { onDone: () => void }) {
  const [reference, setReference] = useState<Upload[]>([]);
  const [link, setLink] = useState("");
  const [product, setProduct] = useState(NO_PRODUCT);
  const [changes, setChanges] = useState("");
  const make = useMakeAd();
  const offeringId = productFields(product).offering_id;

  async function submit() {
    await make.mutateAsync({ format: "video", idea: changes.trim(), offeringId, referenceVideoKey: reference[0]?.key ?? null, referenceUrl: !reference.length && link.trim() ? link.trim() : null });
    onDone();
  }

  const missing = !reference.length && link.trim().length < 5 ? "Add the video to copy, or paste its link" : !offeringId ? "Pick one of your saved products" : null;

  return (
    <div className="flex flex-col gap-6">
      <Field label="Video to copy" hint="Everything comes from this video: its scenes, timing, shots, pace, text and sound. Only the product is yours.">
        <MediaUploader purpose="referenceVideo" max={1} value={reference} onChange={setReference} />
      </Field>
      {!reference.length && (
        <Field label="Or paste a link" htmlFor="copy-link" optional hint="A Meta Ad Library ad, an Instagram, TikTok or YouTube video, or a link to a video file.">
          <TextInput id="copy-link" value={link} onValueChange={setLink} placeholder="https://www.facebook.com/ads/library/?id=…" />
        </Field>
      )}
      <ProductPicker value={product} onChange={setProduct} required />
      <Field label="Changes you want" htmlFor="copy-changes" optional hint="Anything to do differently from the video, e.g. a different setting, a woman speaking, an offer at the end. The rest follows the video.">
        <TextArea id="copy-changes" rows={3} value={changes} onValueChange={setChanges} placeholder="e.g. Shoot it in a modern kitchen and end on our 10% launch offer" />
      </Field>
      <FormFooter
        note={missing ?? "About 10 minutes; it shows here and in This week."}
        label="Create video"
        busy={make.isPending}
        disabled={!!missing}
        error={make.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
