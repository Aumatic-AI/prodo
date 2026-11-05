"use client";

import { Field } from "@/components/kit/Field";
import { Select } from "@/components/kit/Select";
import { styleChoices } from "@/core/content/styles";

const AUTO = "auto";

/** "Your top style" or one of the styles a format can be made in. Null = the top style. */
export function StyleField({ format, value, onChange }: { format: "static" | "video"; value: string | null; onChange: (style: string | null) => void }) {
  const options = [{ value: AUTO, label: "Your top style" }, ...styleChoices(format).map((s) => ({ value: s.id, label: s.label }))];
  return (
    <Field label="Style" htmlFor="style" optional hint="How it looks: your top style from Settings → Content, or pick one for this one.">
      <Select id="style" value={value ?? AUTO} onValueChange={(v) => onChange(v === AUTO ? null : v)} options={options} />
    </Field>
  );
}
