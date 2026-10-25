import { Card } from "@/components/kit/Card";
import { platformMeta } from "@/config/platforms";
import type { PerformanceView } from "@/core/performance/dashboard";
import { num, pct } from "../../lib/format";
import { BarList } from "../shared/BarList";

/** Reach per platform, with posts and engagement rate. The platform icon carries identity; the bars stay one colour. */
export function PlatformsCard({ data }: { data: PerformanceView }) {
  const items = [...data.platforms]
    .sort((a, b) => b.reach - a.reach)
    .map((p) => {
      const meta = platformMeta(p.platform);
      const Icon = meta.icon;
      return {
        key: p.platform,
        label: (
          <>
            <span className="grid size-6 shrink-0 place-items-center rounded-ob text-ob-on-dark" style={{ backgroundColor: meta.color }}>
              <Icon size={13} aria-hidden="true" />
            </span>
            <span className="truncate">{meta.label}</span>
          </>
        ),
        value: p.reach,
        display: `${num(p.reach)} reach`,
        note: `${p.posts} ${p.posts === 1 ? "post" : "posts"} · ${pct(p.er, 2)} engagement rate · ${num(p.engagements)} engagements`,
      };
    });
  return (
    <Card title="By platform" description="Where your posts reach the most people.">
      <BarList items={items} empty="No published posts in this period." />
    </Card>
  );
}
