import { CheckCircle2, SkipForward } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { platformMeta } from "@/config/platforms";
import type { PerformanceView } from "@/core/performance/dashboard";
import { num } from "../../lib/format";
import { Sparkline } from "../charts/Sparkline";

/** Followers over time per account, and how many of Prodo's posts the client approved. */
export function AudienceCard({ data }: { data: PerformanceView }) {
  const f = data.followers;
  const { approved, rejected } = data.approvals;
  const decided = approved + rejected;
  const rate = decided ? approved / decided : null;
  return (
    <Card title="Audience" description="Followers counted daily across connected accounts.">
      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <strong className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{num(f.total)}</strong>
            <span className="mt-1 text-[12.5px] text-ob-muted">
              {f.change !== null ? `${f.change >= 0 ? "+" : ""}${num(f.change)} in ${data.days} days` : "First count comes tomorrow"}
            </span>
          </div>
          <div className="w-1/2 max-w-[220px]">
            <Sparkline data={f.series.map((s) => ({ date: s.date, value: s.total }))} />
          </div>
        </div>

        {f.accounts.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {f.accounts.map((a) => {
              const meta = platformMeta(a.platform);
              const Icon = meta.icon;
              return (
                <li key={a.accountId} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="grid size-6 place-items-center rounded-ob text-ob-on-dark" style={{ backgroundColor: meta.color }}>
                      <Icon size={13} />
                    </span>
                    {meta.label}
                  </span>
                  <span className="font-bold tabular-nums">{num(a.followers)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-ob-line pt-4">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ob-muted">Your yes to Prodo&apos;s posts</span>
          {decided ? (
            <>
              <div className="flex items-baseline gap-2">
                <strong className="text-xl font-extrabold tabular-nums">{Math.round((rate ?? 0) * 100)}%</strong>
                <span className="text-[12.5px] text-ob-muted">approved this period</span>
              </div>
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                <span className="bg-ob-primary" style={{ width: `${(approved / decided) * 100}%` }} />
                <span className="flex-1 bg-ob-line-strong" />
              </div>
              <div className="flex gap-4 text-[12px] text-ob-muted">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-ob-primary" /> {approved} approved
                </span>
                <span className="inline-flex items-center gap-1">
                  <SkipForward size={13} /> {rejected} skipped
                </span>
              </div>
            </>
          ) : (
            <span className="text-[13px] text-ob-muted">No decisions in this period yet.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
