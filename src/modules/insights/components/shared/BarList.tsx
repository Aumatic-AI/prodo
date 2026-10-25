import type { ReactNode } from "react";

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Text shown at the bar's end */
  display: string;
  /** Extra line under the label */
  note?: ReactNode;
}

/** Horizontal bars for one measure, longest first. Text stays in ink; only the bar carries colour. */
export function BarList({ items, empty }: { items: BarListItem[]; empty?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length) return <p className="m-0 text-sm text-ob-muted">{empty ?? "Nothing yet."}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-ob-ink">{item.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-ob-ink">{item.display}</span>
          </div>
          <div className="h-2 rounded-full bg-ob-sunken">
            <div className="h-full rounded-full bg-ob-primary transition-[width] duration-500" style={{ width: `${max ? Math.max(2, (item.value / max) * 100) : 0}%` }} />
          </div>
          {item.note && <span className="text-[11.5px] text-ob-muted">{item.note}</span>}
        </li>
      ))}
    </ul>
  );
}
