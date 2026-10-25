"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
}

/** Type and press Enter (or comma) to add. Backspace on empty removes the last one. */
export function TagInput({ id, value, onChange, placeholder = "Type and press Enter", max = 50 }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !value.some((v) => v.toLowerCase() === t.toLowerCase()));
    if (next.length) onChange([...value, ...next].slice(0, max));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-ob border border-ob-line-strong bg-ob-surface px-2 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-ob-primary focus-within:ring-4 focus-within:ring-ob-focus group-data-[invalid=true]/field:border-ob-danger"
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-full bg-ob-primary-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-ob-primary-ink">
          <span className="truncate">{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="grid size-[22px] place-items-center rounded-full hover:bg-ob-primary/15"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          id={id}
          className="h-[30px] min-w-[120px] flex-[1_1_140px] border-0 bg-transparent text-[15px] text-ob-ink outline-none placeholder:text-ob-faint"
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
        />
      )}
    </div>
  );
}
