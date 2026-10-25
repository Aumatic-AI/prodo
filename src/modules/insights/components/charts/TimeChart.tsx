"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, shortDate } from "../../lib/format";

// One measure over days. Single series: no legend box (the card title names it), recessive
// hairline grid, 2px line with a 10% wash, or ≤24px columns with a 4px rounded top; hover tooltip.

export interface TimePoint {
  date: string;
  value: number;
}

const AXIS = { fontSize: 11.5, fill: "var(--color-ob-faint)" };

function Tip({ active, payload, format }: { active?: boolean; payload?: { payload: TimePoint }[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-ob-md border border-ob-line bg-ob-surface px-3 py-2 font-ob text-[12.5px] shadow-ob-md">
      <div className="text-ob-muted">{shortDate(p.date)}</div>
      <div className="font-bold tabular-nums text-ob-ink">{format(p.value)}</div>
    </div>
  );
}

export function TimeChart({ data, kind = "area", format = num, height = 240 }: { data: TimePoint[]; kind?: "area" | "column"; format?: (n: number) => string; height?: number }) {
  const ticks = data.length > 14 ? Math.ceil(data.length / 7) : 0;
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-ob-line)" strokeWidth={1} />
      <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} interval={ticks} minTickGap={12} />
      <YAxis tickFormatter={(v: number) => format(v)} tick={AXIS} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
      <Tooltip content={<Tip format={format} />} cursor={kind === "area" ? { stroke: "var(--color-ob-line-strong)", strokeWidth: 1 } : { fill: "var(--color-ob-sunken)" }} />
    </>
  );
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "area" ? (
          <AreaChart {...common}>
            {axes}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-ob-primary)"
              strokeWidth={2}
              fill="var(--color-ob-primary)"
              fillOpacity={0.1}
              activeDot={{ r: 5, stroke: "var(--color-ob-surface)", strokeWidth: 2, fill: "var(--color-ob-primary)" }}
              dot={false}
            />
          </AreaChart>
        ) : (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="value" fill="var(--color-ob-primary)" maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
