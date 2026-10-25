import type { ReactNode } from "react";

/** Page title block: optional eyebrow, title, one-line description and actions on the right. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-ob-primary">{eyebrow}</span>}
        <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight text-ob-ink">{title}</h1>
        {description && <p className="m-0 max-w-[680px] text-[15px] text-ob-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
