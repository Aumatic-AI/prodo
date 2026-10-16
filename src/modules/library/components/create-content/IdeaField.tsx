"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import { useImproveIdea } from "../../hooks/useMedia";
import type { MediaType } from "@/core/media";

interface IdeaFieldProps {
  value: string;
  onChange: (value: string) => void;
  format: MediaType;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function IdeaField({ value, onChange, format, placeholder, label = "Your idea", required }: IdeaFieldProps) {
  const improve = useImproveIdea();
  const [options, setOptions] = useState<string[] | null>(null);

  async function handleImprove() {
    if (!value.trim()) return;
    const result = await improve.mutateAsync({ idea: value, format });
    setOptions(result.ideas);
  }

  function selectOption(idea: string) {
    onChange(idea);
    setOptions(null);
  }

  return (
    <div>
      <Textarea
        id="idea"
        label={label}
        required={required}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOptions(null); }}
        placeholder={placeholder}
        className="min-h-[100px]"
      />
      <div className="flex justify-end mt-2">
        <span title={!value.trim() ? "Type an idea first to improve it with AI" : undefined}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImprove}
            loading={improve.isPending}
            disabled={!value.trim()}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Improve
          </Button>
        </span>
      </div>

      {options && options.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 p-3 rounded-lg border border-primary/20 bg-(--color-primary-subtle)">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            AI generated ideas — click to use
          </span>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectOption(opt)}
                className="text-left p-3 rounded-lg border border-default bg-surface hover:border-primary transition-colors text-sm text-text leading-relaxed"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
