import { BookOpen, Clapperboard, LineChart, MoreHorizontal } from "lucide-react";
import type { CostsView } from "@/core/performance/costs";
import { usd } from "../../lib/format";
import { StatTile } from "../shared/StatTile";

/** Spend by kind of work: brand research, making content, learning, everything else. */
export function KindSplit({ data }: { data: CostsView }) {
  const share = (n: number) => (data.total ? `${Math.round((n / data.total) * 100)}% of the month` : undefined);
  const k = data.byKind;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Content (plan, write, make, check, post)" value={usd(k.content)} icon={Clapperboard} hint={share(k.content)} />
      <StatTile label="Brand research" value={usd(k.research)} icon={BookOpen} hint={share(k.research)} />
      <StatTile label="Learning" value={usd(k.learning)} icon={LineChart} hint={share(k.learning)} />
      <StatTile label="Other" value={usd(k.other)} icon={MoreHorizontal} hint={share(k.other)} />
    </div>
  );
}
