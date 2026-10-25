import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-ob-lg border border-dashed border-ob-line-strong bg-ob-surface px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-11 place-items-center rounded-full bg-ob-primary-soft text-ob-primary" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <h3 className="m-0 text-base font-bold text-ob-ink">{title}</h3>
      {description && <p className="m-0 max-w-[420px] text-sm text-ob-muted">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
