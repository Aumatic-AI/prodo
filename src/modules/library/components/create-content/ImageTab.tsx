"use client";

import { useState } from "react";
import { Field } from "@/components/kit/Field";
import { Switch } from "@/components/kit/controls";
import type { Upload } from "@/core/onboarding/schemas";
import { useProfile } from "@/modules/settings/hooks/useProfile";
import { useGenerateMedia } from "../../hooks/useMedia";
import { AspectPicker } from "./AspectPicker";
import { FormFooter } from "./FormFooter";
import { IdeaField } from "./IdeaField";
import { NO_PRODUCT, ProductPicker, productFields } from "./ProductPicker";
import { ReferencePhoto } from "./ReferencePhoto";
import type { Ratio } from "./options";

export function ImageTab({ onDone }: { onDone: () => void }) {
  const [idea, setIdea] = useState("");
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [useLogo, setUseLogo] = useState(true);
  const [product, setProduct] = useState(NO_PRODUCT);
  const [reference, setReference] = useState<Upload[]>([]);
  const generate = useGenerateMedia();
  const { data: profile } = useProfile();
  const hasLogo = !!profile?.logo_key;

  async function submit() {
    await generate.mutateAsync({
      type: "image",
      idea: idea.trim(),
      aspect_ratio: ratio,
      use_logo: hasLogo && useLogo,
      reference_image_key: reference[0]?.key,
      ...productFields(product),
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-6">
      <IdeaField value={idea} onChange={setIdea} format="image" placeholder="e.g. Our iced latte on a sunny café table, morning light, fresh and inviting" />
      <Field label="Size">
        <AspectPicker value={ratio} onChange={setRatio} />
      </Field>
      <ProductPicker value={product} onChange={setProduct} />
      <ReferencePhoto value={reference} onChange={setReference} hint="A real photo of the product or place keeps the image true to life." />
      {hasLogo && (
        <div className="flex items-center justify-between gap-4 rounded-ob-md border border-ob-line bg-ob-surface px-4 py-3">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Add your logo</span>
            <span className="text-[13px] text-ob-muted">Placed by our code in the corner, never redrawn by the AI.</span>
          </span>
          <Switch checked={useLogo} onChange={setUseLogo} label={useLogo ? "On" : "Off"} />
        </div>
      )}
      <FormFooter
        note="Takes about a minute. You can close this window."
        label="Generate image"
        busy={generate.isPending}
        disabled={!idea.trim()}
        error={generate.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
