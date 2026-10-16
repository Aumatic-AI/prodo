import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-primary text-on-primary hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-xs",
  secondary:
    "bg-surface text-text border border-default hover:bg-surface-hover shadow-xs",
  ghost:
    "text-muted hover:bg-surface-hover hover:text-text",
  danger:
    "bg-danger text-white hover:bg-[#d13438] active:bg-[#c42b2f] shadow-xs",
  outline:
    "border border-default text-text hover:bg-surface-hover shadow-xs",
};

const sizes = {
  sm: "h-8 text-xs gap-1.5 rounded-md",
  md: "h-10 text-sm gap-2 rounded-lg",
  lg: "h-12 text-sm gap-2 rounded-lg",
  icon: "h-10 w-10 rounded-lg justify-center",
};

const paddings: Record<string, string> = {
  sm: "20px",
  md: "24px",
  lg: "32px",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, style, ...props }, ref) => {
    const px = paddings[size];
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-ring",
          "disabled:opacity-50 disabled:pointer-events-none",
          "[&_svg]:shrink-0 [&_svg]:size-4",
          variants[variant],
          sizes[size],
          className
        )}
        style={px ? { paddingLeft: px, paddingRight: px, ...style } : style}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
