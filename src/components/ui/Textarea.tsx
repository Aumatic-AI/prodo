import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={id} className="text-sm font-medium text-text">
              {label}{props.required && <span className="text-danger ml-0.5">*</span>}
            </label>
            {hint && <span className="text-xs text-secondary">{hint}</span>}
          </div>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            "min-h-[120px] w-full rounded-lg border bg-page px-3 py-2.5 text-sm text-text placeholder:text-secondary resize-y",
            "transition-colors focus-ring",
            error ? "border-danger" : "border-default hover:border-strong",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
