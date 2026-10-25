"use client";

import { Field } from "@/components/kit/Field";
import { MediaUploader } from "@/components/kit/MediaUploader";
import type { Upload } from "@/core/onboarding/schemas";

/** One optional photo that guides what the AI draws (uploaded straight to storage). */
export function ReferencePhoto({ value, onChange, hint }: { value: Upload[]; onChange: (v: Upload[]) => void; hint: string }) {
  return (
    <Field label="Reference photo" optional hint={hint}>
      <MediaUploader purpose="photo" value={value} onChange={onChange} max={1} />
    </Field>
  );
}
