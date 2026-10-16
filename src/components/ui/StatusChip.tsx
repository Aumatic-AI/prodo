import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  ready: "bg-success-bg text-success border-success-border",
  generating: "bg-info-bg text-info border-info-border",
  published: "bg-success-bg text-success border-success-border",
  scheduled: "bg-primary-subtle text-primary border-primary-border",
  draft: "bg-surface-sunken text-muted border-default",
  failed: "bg-danger-bg text-danger border-danger-border",
  sending: "bg-warning-bg text-warning border-warning-border",
  pending: "bg-surface-sunken text-secondary border-default",
  partial: "bg-warning-bg text-warning border-warning-border",
  publishing: "bg-info-bg text-info border-info-border",
};

interface StatusChipProps {
  status: string;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const style = styles[status] || styles.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border capitalize",
        style,
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
