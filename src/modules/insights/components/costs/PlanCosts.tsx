import Link from "next/link";
import { Card } from "@/components/kit/Card";
import type { CostsView } from "@/core/performance/costs";
import { shortDate, usd } from "../../lib/format";

/** What each weekly plan cost, and per post. */
export function PlanCosts({ plans }: { plans: CostsView["byPlan"] }) {
  return (
    <Card title="Weekly plans" description="Planning, writing, making and checking every post of a week.">
      {plans.length ? (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">
                <th className="px-2 pb-2 font-bold">Week of</th>
                <th className="px-2 pb-2 text-right font-bold">Posts</th>
                <th className="px-2 pb-2 text-right font-bold">Cost</th>
                <th className="px-2 pb-2 text-right font-bold">Per post</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.planId} className="border-t border-ob-line">
                  <td className="px-2 py-2.5">
                    {p.weekStart ? (
                      <Link href={`/week?week=${p.weekStart}`} className="font-semibold text-ob-ink hover:text-ob-primary">
                        {shortDate(p.weekStart)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{p.posts}</td>
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums">{usd(p.cost)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-ob-muted">{p.posts ? usd(p.cost / p.posts) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 text-sm text-ob-muted">No weekly plans this month.</p>
      )}
    </Card>
  );
}
