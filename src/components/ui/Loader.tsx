import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const sizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

interface LoaderProps {
  size?: keyof typeof sizes;
  className?: string;
}

export function Loader({ size = "md", className }: LoaderProps) {
  return (
    <Loader2
      className={cn("animate-spin text-primary", sizes[size], className)}
    />
  );
}
