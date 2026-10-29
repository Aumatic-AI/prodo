"use client";

import type { ReactNode } from "react";
import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { useFieldError, useHasErrorUnder } from "../store/OnboardingStoreProvider";
import { button, card, control, focusRing, numberBadge, sectionTitle } from "@/components/kit/styles";

interface SectionProps {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  /** Store path of a list-level error shown under the title */
  path?: string;
  children: ReactNode;
}

/** White card that groups related questions. */
export function Section({ title, description, badge, path, children }: SectionProps) {
  const error = useFieldError(path ?? "");
  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className={sectionTitle}>{title}</h2>
          {badge}
        </div>
        {description && <p className="m-0 text-sm text-ob-muted">{description}</p>}
        {path && error && <Alert tone="error">{error}</Alert>}
      </div>
      {children}
    </section>
  );
}

export function OptionalBadge() {
  return <span className="inline-flex items-center rounded-full bg-ob-sunken px-2.5 py-0.5 text-xs font-semibold text-ob-muted">Optional</span>;
}

/** Shown on answers the website scan filled in. */
export function FromSiteBadge({ children = "Filled from your website" }: { children?: ReactNode }) {
  return (
    <Badge tone="success">
      <Check size={12} strokeWidth={3} aria-hidden="true" />
      {children}
    </Badge>
  );
}

/** Shown on answers AI drafted from the website, for the client to check. */
export function AiDraftBadge() {
  return (
    <Badge tone="primary">
      <Sparkles size={12} aria-hidden="true" />
      AI draft · check it
    </Badge>
  );
}

interface ItemCardProps {
  index: number;
  title: string;
  onRemove?: () => void;
  removeLabel?: string;
  /** Any error under this path marks the card */
  pathPrefix?: string;
  aside?: ReactNode;
  children: ReactNode;
}

/** One entry in a repeatable list, e.g. "Product 2". */
export function ItemCard({ index, title, onRemove, removeLabel = "Remove", pathPrefix, aside, children }: ItemCardProps) {
  const hasError = useHasErrorUnder(pathPrefix);
  return (
    <div
      data-invalid={hasError ? "true" : undefined}
      className={cn("flex flex-col gap-4 rounded-ob-md border bg-ob-surface p-[18px]", hasError ? "border-ob-danger" : "border-ob-line")}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="m-0 flex items-center gap-2 text-[15px] font-bold">
          <span className={numberBadge}>{index + 1}</span>
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-2.5">
          {aside}
          {onRemove && (
            <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label={`${removeLabel} ${title}`} onClick={onRemove}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function AddButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-ob-md border border-dashed border-ob-line-strong text-sm font-bold text-ob-primary transition-colors",
        "hover:border-ob-primary hover:bg-ob-primary-soft disabled:opacity-55",
        focusRing
      )}
    >
      <Plus size={16} />
      {children}
    </button>
  );
}

interface NumberedListProps {
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  placeholder: (index: number) => string;
  addLabel: string;
  label: string;
}

/** Ordered short answers, e.g. process steps or FAQs. */
export function NumberedList({ value, onChange, max, placeholder, addLabel, label }: NumberedListProps) {
  const rows = value.length ? value : [""];
  const set = (i: number, text: string) => onChange(rows.map((v, j) => (j === i ? text : v)));
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      {rows.map((v, i) => (
        <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2">
          <span className={numberBadge}>{i + 1}</span>
          <input
            className={control}
            value={v}
            placeholder={placeholder(i)}
            aria-label={`${label} ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
          />
          <button
            type="button"
            className={button({ variant: "danger", size: "icon" })}
            aria-label={`Remove ${label} ${i + 1}`}
            disabled={rows.length === 1 && !v}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className={cn(button({ variant: "ghost", size: "sm" }), "self-start")} onClick={() => onChange([...rows, ""])}>
          <Plus size={15} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

export { Alert };
