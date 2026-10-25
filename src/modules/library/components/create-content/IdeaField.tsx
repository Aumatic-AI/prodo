"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/kit/Field";
import { TextArea } from "@/components/kit/inputs";
import { button, focusRing } from "@/components/kit/styles";
import type { MediaType } from "@/core/media";
import { useImproveIdea } from "../../hooks/useMedia";

interface IdeaFieldProps {
  value: string;
  onChange: (value: string) => void;
  format: MediaType;
  placeholder: string;
}

/** The idea, with "Improve" offering three sharper versions to pick from. */
export function IdeaField({ value, onChange, format, placeholder }: IdeaFieldProps) {
  const improve = useImproveIdea();
  const [options, setOptions] = useState<string[] | null>(null);

  async function suggest() {
    const { ideas } = await improve.mutateAsync({ idea: value, format });
    setOptions(ideas);
  }

  return (
    <Field
      label={
        <span className="flex items-center justify-between gap-2">
          Your idea
          <button type="button" className={button({ variant: "ghost", size: "xs" })} disabled={!value.trim() || improve.isPending} onClick={suggest}>
            {improve.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Improve with AI
          </button>
        </span>
      }
      htmlFor="idea"
      error={improve.error?.message}
    >
      <TextArea
        id="idea"
        rows={4}
        value={value}
        placeholder={placeholder}
        onValueChange={(v) => {
          onChange(v);
          setOptions(null);
        }}
      />
      {options && (
        <div className="flex flex-col gap-2 rounded-ob-md border border-ob-primary/25 bg-ob-primary-soft p-3">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-primary">Pick one, or keep yours</span>
          {options.map((idea, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(idea);
                setOptions(null);
              }}
              className={cn(
                "group flex items-start gap-3 rounded-ob border border-ob-line bg-ob-surface p-3 text-left text-sm leading-relaxed text-ob-ink-soft transition-[border-color,box-shadow] hover:border-ob-primary hover:shadow-ob-sm",
                focusRing
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ob-primary-soft text-xs font-bold text-ob-primary group-hover:bg-ob-primary group-hover:text-ob-on-primary">
                <span className="group-hover:hidden">{i + 1}</span>
                <Check size={13} className="hidden group-hover:block" />
              </span>
              {idea}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
