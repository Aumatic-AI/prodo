"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Images, Package, Palette, Percent, Quote, Swords, Target, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { PageHeader } from "@/components/kit/PageHeader";
import { SectionNav, type SectionNavItem } from "@/components/kit/SectionNav";
import type { ResourceRow } from "@/core/brand/resources";
import type { PendingKind } from "@/core/brand/pending";
import { useBibleOverview, usePendingFacts } from "../hooks/useBible";
import { AssetsTab } from "../components/AssetsTab";
import { BibleReview } from "../components/bible/BibleReview";
import { KitTab } from "../components/KitTab";
import { RefreshButton, RefreshProgress } from "../components/RefreshPanel";
import { ResourceList } from "../components/resources/ResourceList";

type Tab = "bible" | "offerings" | "offers" | "proof" | "assets" | "personas" | "pillars" | "competitors" | "kit";

/** A competitor's analysis from the Social & Market Analyst, under its card. */
function CompetitorAnalysis({ row }: { row: ResourceRow }) {
  const a = row.analysis as { positioning?: string | null; angles?: string[]; gaps?: string[]; activeAds?: { meta: number; google: number }; followers?: number | null } | null;
  if (!a) return <p className="m-0 text-[13px] text-ob-faint">Not studied yet. The next refresh reads their website, posts and ads.</p>;
  const list = (label: string, items: string[] | undefined, tone: "neutral" | "success") =>
    items?.length ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ob-faint">{label}</span>
        <div className="flex flex-wrap gap-1.5">
          {items.map((x, i) => (
            <Badge key={i} tone={tone} size="sm" className="whitespace-normal text-left">
              {x}
            </Badge>
          ))}
        </div>
      </div>
    ) : null;
  return (
    <div className="flex flex-col gap-3 border-t border-ob-line pt-3">
      {a.positioning && <p className="m-0 text-[13.5px] text-ob-ink-soft">{a.positioning}</p>}
      {list("Their angles", a.angles, "neutral")}
      {list("Gaps you could own", a.gaps, "success")}
      <div className="flex flex-wrap gap-3 text-xs text-ob-muted">
        {a.activeAds && (
          <span>
            Active ads: <strong className="text-ob-ink">{a.activeAds.meta}</strong> Meta · <strong className="text-ob-ink">{a.activeAds.google}</strong> Google
          </span>
        )}
        {a.followers != null && (
          <span>
            Instagram: <strong className="text-ob-ink">{a.followers.toLocaleString("en")}</strong> followers
          </span>
        )}
      </div>
    </div>
  );
}

const TABS: { value: Tab; label: string; icon: LucideIcon; pending?: PendingKind; description: string; render: () => ReactNode }[] = [
  { value: "bible", label: "Brand Bible", icon: BookOpen, description: "The rules every post follows. Edit, regenerate or approve a new version.", render: () => <BibleReview showHistory /> },
  {
    value: "offerings",
    label: "Offerings",
    icon: Package,
    pending: "offering",
    description: "Products and services. Hero offerings get the most posts.",
    render: () => <ResourceList resource="offerings" emptyIcon={Package} emptyText="Add what you sell so agents can promote it." />,
  },
  {
    value: "offers",
    label: "Offers",
    icon: Percent,
    pending: "offer",
    description: "Deals and codes. Urgency copy is only used while an offer is live.",
    render: () => <ResourceList resource="offers" emptyIcon={Percent} emptyText="Add a deal or discount to promote." />,
  },
  {
    value: "proof",
    label: "Proof",
    icon: Quote,
    pending: "proof",
    description: "Reviews, results, case studies and awards. Ads only quote confirmed proof.",
    render: () => <ResourceList resource="proof" emptyIcon={Quote} emptyText="Add a review, a result or a case study." />,
  },
  { value: "assets", label: "Photos and videos", icon: Images, description: "Your real photos and videos, used as references and in ads.", render: () => <AssetsTab /> },
  {
    value: "personas",
    label: "Personas",
    icon: Users,
    description: "Who your customers are. Each post speaks to one of them.",
    render: () => <ResourceList resource="personas" layout="cards" emptyIcon={Users} emptyText="Personas come with your approved Brand Bible, or add your own." />,
  },
  {
    value: "pillars",
    label: "Pillars",
    icon: Target,
    description: "Recurring themes and their share of the weekly plan.",
    render: () => <ResourceList resource="pillars" emptyIcon={Target} emptyText="Pillars come with your approved Brand Bible, or add your own." />,
  },
  {
    value: "competitors",
    label: "Competitors",
    icon: Swords,
    description: "Who you compete with, and what the research found about them. Their claims are never used as yours.",
    render: () => (
      <ResourceList
        resource="competitors"
        layout="cards"
        emptyIcon={Swords}
        emptyText="Add a competitor; the next refresh studies their website, posts and ads."
        badge={(row) =>
          row.source === "discovered" ? (
            <Badge tone="primary" size="sm">
              Found by Prodo
            </Badge>
          ) : null
        }
        renderExtra={(row) => <CompetitorAnalysis row={row} />}
      />
    ),
  },
  { value: "kit", label: "Brand kit", icon: Palette, description: "Colours, fonts, logo versions and visual style.", render: () => <KitTab /> },
];

/** Brand Hub: everything the system knows about the brand, in one place. */
export function BrandPage() {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find((t) => t.value === params.get("tab")) ?? TABS[0];
  const { data: pending } = usePendingFacts();
  const { data: overview } = useBibleOverview();

  const navItems: SectionNavItem<Tab>[] = TABS.map((t) => {
    const waiting = t.pending ? (pending?.filter((p) => p.kind === t.pending).length ?? 0) : t.value === "bible" ? (overview?.draft ? 1 : 0) : 0;
    return { value: t.value, label: t.label, icon: t.icon, count: waiting, alert: waiting > 0 };
  });

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-7">
      <PageHeader title="Brand" description="Everything Prodo knows about your brand. Agents only use what's here." actions={<RefreshButton />} />
      <RefreshProgress />

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
        <SectionNav label="Brand sections" items={navItems} value={active.value} onChange={(tab) => router.replace(`/brand?tab=${tab}`, { scroll: false })} />

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-extrabold tracking-tight">{active.label}</h2>
            <p className="m-0 text-sm text-ob-muted">{active.description}</p>
          </div>
          {active.render()}
        </div>
      </div>
    </div>
  );
}
