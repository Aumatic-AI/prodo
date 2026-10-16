import { Users, Eye, Heart, Radar, Link2 } from "lucide-react";
import { KpiTile, ACCENT } from "@/components/dashboard/DashboardKit";
import type { DashboardData } from "../hooks/useDashboard";
import { formatCount } from "../lib/platforms";

export function KpiRow({ kpis }: { kpis: DashboardData["kpis"] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiTile icon={Users} accent={ACCENT.purple} value={formatCount(kpis.totalFollowers)} label="Total followers" sublabel="all connected accounts" />
      <KpiTile icon={Eye} accent={ACCENT.blue} value={formatCount(kpis.totalImpressions)} label="Impressions" sublabel="last 30 days" />
      <KpiTile icon={Radar} accent={ACCENT.green} value={formatCount(kpis.totalReach)} label="Reach" sublabel="unique accounts reached" />
      <KpiTile icon={Heart} accent={ACCENT.red} value={formatCount(kpis.totalEngagement)} label="Engagement" sublabel="likes, comments, shares, saves" />
      <KpiTile icon={Link2} accent={ACCENT.amber} value={kpis.connectedAccounts.toString()} label="Connected" />
    </div>
  );
}
