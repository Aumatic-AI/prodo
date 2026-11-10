"use client";

import { useState } from "react";
import { Field } from "@/components/kit/Field";
import { TextArea } from "@/components/kit/inputs";
import { useMakeAd } from "../../hooks/useMedia";
import { EMPTY_VIDEO_TO_COPY, VideoToCopy, videoToCopyInput, videoToCopyMissing } from "../ad-library/VideoToCopy";
import { FormFooter } from "./FormFooter";
import { NO_PRODUCT, ProductPicker, productFields } from "./ProductPicker";

/** A video the owner likes, made again with their product: everything but the product comes from the video. */
export function CopyTab({ onDone }: { onDone: () => void }) {
  const [video, setVideo] = useState(EMPTY_VIDEO_TO_COPY);
  const [product, setProduct] = useState(NO_PRODUCT);
  const [changes, setChanges] = useState("");
  const make = useMakeAd();
  const offeringId = productFields(product).offering_id;

  async function submit() {
    await make.mutateAsync({ format: "video", idea: changes.trim(), offeringId, ...videoToCopyInput(video) });
    onDone();
  }

  const missing = videoToCopyMissing(video) ?? (!offeringId ? "Pick one of your saved products" : null);

  return (
    <div className="flex flex-col gap-6">
      <VideoToCopy id="copy-link" value={video} onChange={setVideo} />
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
