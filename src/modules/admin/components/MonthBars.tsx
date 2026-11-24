"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Two measures per month side by side (money in vs. our AI cost, or credits used vs. added). Hairline grid,
// columns with a rounded top, a small legend above, the exact values on hover.

export interface MonthBarSeries {
  key: string;
  label: string;
  /** A theme colour variable, e.g. var(--color-ob-primary) */
  color: string;
}

const AXIS = { fontSize: 11.5, fill: "var(--color-ob-faint)" };
const monthShort = (d: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${d.slice(0, 7)}-15T12:00:00Z`));

function Tip({ active, payload, label, series, format }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: MonthBarSeries[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-ob-md border border-ob-line bg-ob-surface px-3 py-2 font-ob text-[12.5px] shadow-ob-md">
      <span className="text-ob-muted">{label ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${label.slice(0, 7)}-15T12:00:00Z`)) : ""}</span>
      {series.map((s) => (
        <span key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ob-muted">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
          <strong className="tabular-nums text-ob-ink">{format(payload.find((p) => p.dataKey === s.key)?.value ?? 0)}</strong>
        </span>
      ))}
    </div>
  );
}

export function MonthBars<T extends { bucket: string }>({ data, series, format, height = 240 }: { data: T[]; series: MonthBarSeries[]; format: (n: number) => string; height?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-[12px] text-ob-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--color-ob-line)" strokeWidth={1} />
            <XAxis dataKey="bucket" tickFormatter={monthShort} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v: number) => format(v)} tick={AXIS} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<Tip series={series} format={format} />} cursor={{ fill: "var(--color-ob-sunken)" }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={22} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
