import type { ReactNode } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { StepKey } from "@/core/onboarding/steps";
import { cn } from "@/lib/utils";
import { publicUrl } from "@/components/kit/MediaUploader";
import { button, card, numberBadge, sectionTitle } from "@/components/kit/styles";

// Read-only building blocks for the Review step

export function ReviewCard({ title, step, children }: { title: string; step?: StepKey; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={sectionTitle}>{title}</h2>
        {step && (
          <Link href={`/onboarding/${step}`} className={button({ variant: "ghost", size: "sm" })}>
            <Pencil size={14} />
            Edit
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === false || value === "" || (Array.isArray(value) && value.length === 0);

/** Label and value rows. Empty values show a dash. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("m-0 flex flex-col divide-y divide-ob-line border-t border-ob-line", className)}>{children}</dl>;
}

export function Row({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 text-sm sm:grid-cols-[200px_minmax(0,1fr)]">
      <dt className="text-ob-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words font-medium">{isEmpty(children) ? <span className="text-ob-faint">—</span> : children}</dd>
    </div>
  );
}

/** A titled list of items inside a card, e.g. every product. */
export function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-[15px] font-bold">
        {title}
        {count !== undefined && <span className="ml-1.5 font-semibold text-ob-muted">({count})</span>}
      </h3>
      {count === 0 ? <p className="m-0 text-sm text-ob-faint">None added</p> : children}
    </div>
  );
}

/** One item in a Group: a numbered box with a title and optional badge. */
export function Item({ index, title, badge, children }: { index: number; title: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-ob-md border border-ob-line bg-ob-bg p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={numberBadge}>{index + 1}</span>
        <span className="min-w-0 break-words font-bold">{title || <span className="text-ob-faint">Untitled</span>}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-ob-primary-soft px-2.5 py-0.5 text-xs font-bold text-ob-primary">{children}</span>;
}

export function Chips({ items, numbered }: { items: string[]; numbered?: boolean }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((item, i) => (
        <span key={`${item}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-ob-line bg-ob-surface px-2.5 py-1 text-[13px] font-semibold">
          {numbered && <span className="text-ob-primary">{i + 1}</span>}
          {item}
        </span>
      ))}
    </span>
  );
}

export function BulletList({ items }: { items: string[] }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
      {shown.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function ExternalLink({ href }: { href: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all text-ob-primary underline-offset-2 hover:underline">
      {href.replace(/^https?:\/\/(www\.)?/, "")}
    </a>
  );
}

/** Thumbnails of uploaded photos or videos, with an optional tag on each. */
export function Thumbs({ items, video }: { items: { key: string; tag?: string }[]; video?: boolean }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {items.map(({ key, tag }) => (
        <span key={key} className="relative size-20 overflow-hidden rounded-ob border border-ob-line bg-ob-sunken">
          {video ? (
            <video src={publicUrl(key)} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(key)} alt="" className="size-full object-cover" />
          )}
          {tag && <span className="absolute inset-x-1 bottom-1 truncate rounded bg-ob-dark/70 px-1.5 py-0.5 text-[11px] font-semibold text-ob-on-dark">{tag}</span>}
        </span>
      ))}
    </span>
  );
}
