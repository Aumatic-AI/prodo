import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ALERT = {
  warn: { icon: AlertTriangle, className: "bg-ob-warn-soft text-ob-warn" },
  error: { icon: XCircle, className: "bg-ob-danger-soft text-ob-danger" },
  info: { icon: Info, className: "bg-ob-primary-soft text-ob-primary-ink" },
  success: { icon: CheckCircle2, className: "bg-ob-success-soft text-ob-success" },
};

export function Alert({ tone, children, className }: { tone: keyof typeof ALERT; children: ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = ALERT[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-ob-md px-4 py-3.5 text-sm", toneClass, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
