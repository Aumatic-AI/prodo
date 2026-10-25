"use client";

import { useState } from "react";
import { Field } from "@/components/kit/Field";
import { TextArea } from "@/components/kit/inputs";
import { useGenerateMedia } from "../../hooks/useMedia";
import { FormFooter } from "./FormFooter";

const LIMITS = [
  { name: "X", max: 280 },
  { name: "LinkedIn", max: 3000 },
];

export function TextTab({ onDone }: { onDone: () => void }) {
  const [content, setContent] = useState("");
  const generate = useGenerateMedia();
  const length = content.trim().length;

  async function submit() {
    await generate.mutateAsync({ type: "text", content: content.trim() });
    onDone();
  }

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Post text"
        htmlFor="content"
        hint={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-semibold tabular-nums text-ob-ink">{length} characters</span>
            {LIMITS.map((l) => (
              <span key={l.name} className={length > l.max ? "font-semibold text-ob-warn" : undefined}>
                {l.name}: {length > l.max ? `${length - l.max} over` : `${l.max - length} left`}
              </span>
            ))}
          </span>
        }
      >
        <TextArea id="content" rows={9} value={content} onValueChange={setContent} placeholder="Write your post. Captions per platform are added when you post it." />
      </Field>
      <FormFooter note="Saved straight to your library." label="Save to library" busy={generate.isPending} disabled={!length} error={generate.error?.message} onSubmit={() => submit().catch(() => undefined)} />
    </div>
  );
}
