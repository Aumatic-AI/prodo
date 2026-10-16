import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, options, placeholder, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text">
            {label}{props.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={id}
            ref={ref}
            className={cn(
              "h-10 w-full appearance-none rounded-lg border bg-page px-3 pr-9 text-sm text-text",
              "transition-colors focus-ring cursor-pointer",
              error ? "border-danger" : "border-default hover:border-strong",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
