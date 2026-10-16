import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "border-2 border-dashed border-default rounded-xl",
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-surface-sunken mb-4">
          <Icon className="w-6 h-6 text-secondary" />
        </div>
      )}
      <h3 className="text-sm font-medium text-text">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
