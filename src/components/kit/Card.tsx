import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right side of the header: buttons, badges */
  actions?: ReactNode;
  className?: string;
  /** Classes for the body (default padding 24px) */
  bodyClassName?: string;
  children?: ReactNode;
}

/** White card with an optional header. The basic building block of every page. */
export function Card({ title, description, actions, className, bodyClassName, children }: CardProps) {
  const hasHeader = !!(title || actions);
  return (
    <section className={cn("rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            {title && <h2 className="m-0 text-[17px] font-bold tracking-tight text-ob-ink">{title}</h2>}
            {description && <p className="m-0 text-sm text-ob-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={cn("p-6", hasHeader && "pt-4", bodyClassName)}>{children}</div>}
    </section>
  );
}
