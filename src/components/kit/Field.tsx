"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { hint as hintClass, label as labelClass } from "./styles";

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label, control and either a hint or an error. An error turns the controls inside red. */
export function Field({ label, htmlFor, optional, hint, error, className, children }: FieldProps) {
  return (
    // data-invalid lets inputs inside turn red (group-data-[invalid=true]/field)
    <div data-invalid={error ? "true" : undefined} className={cn("group/field flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label className={labelClass} htmlFor={htmlFor}>
          {label}
          {optional && <span className="font-normal text-ob-muted"> (optional)</span>}
        </label>
      )}
      {children}
      {error ? <FieldError>{error}</FieldError> : hint && <span className={hintClass}>{hint}</span>}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ob-danger" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {children}
    </span>
  );
}
