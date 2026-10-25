"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { control } from "@/components/kit/styles";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onValueChange: (value: string) => void;
  /** Text shown inside the field before the value, e.g. "$" */
  prefix?: string;
};

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { onValueChange, prefix, className, ...props },
  ref
) {
  const input = (
    <input ref={ref} className={cn(control, prefix && "pl-9", className)} onChange={(e) => onValueChange(e.target.value)} {...props} />
  );
  if (!prefix) return input;
  return (
    <div className="relative flex w-full items-center">
      <span className="pointer-events-none absolute left-3.5 text-[15px] text-ob-muted" aria-hidden="true">
        {prefix}
      </span>
      {input}
    </div>
  );
});

type NumberProps = Omit<InputProps, "value" | "onValueChange" | "type"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};

/** Number field that keeps an empty value as null. */
export function NumberInput({ value, onValueChange, ...props }: NumberProps) {
  return (
    <TextInput
      {...props}
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      onValueChange={(v) => onValueChange(v === "" ? null : Number(v))}
    />
  );
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  onValueChange: (value: string) => void;
};

export function TextArea({ onValueChange, className, rows = 3, ...props }: AreaProps) {
  return <textarea className={cn(control, "resize-y leading-normal", className)} rows={rows} onChange={(e) => onValueChange(e.target.value)} {...props} />;
}

