import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "border border-danger-border rounded-xl bg-danger-bg",
        className
      )}
    >
      <AlertCircle className="w-8 h-8 text-danger mb-3" />
      <p className="text-sm text-danger font-medium">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
