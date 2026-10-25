"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { num, shortDate } from "../../lib/format";

/** A tiny trend line with an end dot and a hover value. */
export function Sparkline({ data, height = 56 }: { data: { date: string; value: number }[]; height?: number }) {
  if (data.length < 2) return null;
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Tooltip
            cursor={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-ob border border-ob-line bg-ob-surface px-2 py-1 font-ob text-[12px] shadow-ob-sm">
                  {shortDate(String(payload[0].payload.date))}: <strong className="tabular-nums">{num(Number(payload[0].value))}</strong>
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-ob-primary)"
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === data.length - 1 ? <circle key="end" cx={props.cx} cy={props.cy} r={4} fill="var(--color-ob-primary)" stroke="var(--color-ob-surface)" strokeWidth={2} /> : <g key={props.index} />
            }
            activeDot={{ r: 4, stroke: "var(--color-ob-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
