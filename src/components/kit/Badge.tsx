import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badge = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold", {
  variants: {
    tone: {
      neutral: "bg-ob-sunken text-ob-muted",
      primary: "bg-ob-primary-soft text-ob-primary",
      success: "bg-ob-success-soft text-ob-success",
      warn: "bg-ob-warn-soft text-ob-warn",
      danger: "bg-ob-danger-soft text-ob-danger",
      dark: "bg-ob-dark text-ob-on-dark",
    },
    size: { sm: "px-2 py-0.5 text-[11.5px]", md: "px-2.5 py-1 text-xs" },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export function Badge({ tone, size, className, children }: VariantProps<typeof badge> & { className?: string; children: ReactNode }) {
  return <span className={cn(badge({ tone, size }), className)}>{children}</span>;
}
