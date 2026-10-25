import { Eye, Heart, Percent, Send, Users } from "lucide-react";
import type { PerformanceView } from "@/core/performance/dashboard";
import { change, num, pct } from "../../lib/format";
import { StatTile } from "../shared/StatTile";

/** Posts, reach, engagements, engagement rate and followers, each against the previous period. */
export function KpiRow({ data }: { data: PerformanceView }) {
  const t = data.totals;
  const p = data.previous;
  const f = data.followers;
  const since = `vs previous ${data.days} days`;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatTile label="Posts published" value={num(t.posts)} delta={change(t.posts, p.posts)} icon={Send} hint={since} />
      <StatTile label="Reach" value={num(t.reach)} delta={change(t.reach, p.reach)} icon={Eye} hint={since} />
      <StatTile label="Engagements" value={num(t.engagements)} delta={change(t.engagements, p.engagements)} icon={Heart} hint="likes, comments, shares, saves" />
      <StatTile label="Engagement rate" value={pct(t.er, 2)} delta={change(t.er, p.er)} icon={Percent} hint="average per post" />
      <StatTile
        label="Followers"
        value={num(f.total)}
        delta={f.total !== null && f.change !== null && f.total - f.change > 0 ? f.change / (f.total - f.change) : null}
        icon={Users}
        hint={f.change !== null ? `${f.change >= 0 ? "+" : ""}${num(f.change)} in ${data.days} days` : "counted daily"}
      />
    </div>
  );
}
