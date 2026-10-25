"use client";

import { useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { Pills } from "@/components/kit/choices";
import type { Upload } from "@/core/onboarding/schemas";
import { useSaveUploads } from "../../hooks/useMedia";
import { FormFooter } from "./FormFooter";
import { NO_PRODUCT, ProductPicker, productFields } from "./ProductPicker";

type Kind = "photo" | "video";

const KINDS = [
  { value: "photo" as const, label: "Photos", icon: <ImageIcon size={15} /> },
  { value: "video" as const, label: "Videos", icon: <Video size={15} /> },
];

const MAX = 10;

/** Files go straight to storage as they're picked; saving adds them to the library. */
export function UploadTab({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("photo");
  const [files, setFiles] = useState<Record<Kind, Upload[]>>({ photo: [], video: [] });
  const [note, setNote] = useState("");
  const [product, setProduct] = useState(NO_PRODUCT);
  const save = useSaveUploads();
  const keys = [...files.photo, ...files.video].map((f) => f.key);

  async function submit() {
    // "Other" names aren't stored for uploads; a saved offering is
    await save.mutateAsync({ keys, idea: note.trim() || undefined, offering_id: productFields(product).offering_id });
    onDone();
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="What are you adding?">
        <Pills options={KINDS} value={kind} onChange={setKind} label="File type" />
      </Field>
      <MediaUploader key={kind} purpose={kind} value={files[kind]} onChange={(v) => setFiles((f) => ({ ...f, [kind]: v }))} max={MAX} />
      <Field label="Description" htmlFor="upload-note" optional hint="Helps you find it later.">
        <TextInput id="upload-note" value={note} onValueChange={setNote} placeholder="e.g. Team photo at the summer market" />
      </Field>
      <ProductPicker value={product} onChange={setProduct} />
      <FormFooter
        note={keys.length ? `${keys.length} file${keys.length === 1 ? "" : "s"} ready` : "Add up to 10 photos and 10 videos."}
        label={keys.length > 1 ? `Add ${keys.length} to library` : "Add to library"}
        busy={save.isPending}
        disabled={!keys.length}
        error={save.error?.message}
        onSubmit={() => submit().catch(() => undefined)}
      />
    </div>
  );
}
