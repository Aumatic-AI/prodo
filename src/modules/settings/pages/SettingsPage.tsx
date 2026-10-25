"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Building2, Share2 } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { PageHeader } from "@/components/kit/PageHeader";
import { SectionNav, type SectionNavItem } from "@/components/kit/SectionNav";
import { AccountsList } from "@/modules/accounts/components/AccountsList";
import { AutomationForm } from "../components/AutomationForm";
import { BusinessProfileForm } from "../components/BusinessProfileForm";

type Tab = "profile" | "automation" | "accounts";

const TABS: (SectionNavItem<Tab> & { title: string; description: string })[] = [
  { value: "profile", label: "Business profile", icon: Building2, title: "Business profile", description: "Your business basics. Offerings, tone and personas live in Brand." },
  { value: "automation", label: "Automation", icon: Bot, title: "Automation", description: "How much the agents do on their own, when they plan, and how much they may spend." },
  { value: "accounts", label: "Connected accounts", icon: Share2, title: "Connected accounts", description: "Where Prodo publishes. You sign in on each platform's own page; we never see your password." },
];

/** Settings, with the open section in the URL (?tab=accounts) so links can point at it. */
export function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const active = TABS.find((t) => t.value === params.get("tab")) ?? TABS[0];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
      <PageHeader title="Settings" description="Your business, how the agents work, and where they post." />

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
        <SectionNav label="Settings sections" items={TABS} value={active.value} onChange={(tab) => router.replace(`/settings?tab=${tab}`, { scroll: false })} />

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-extrabold tracking-tight">{active.title}</h2>
            <p className="m-0 text-sm text-ob-muted">{active.description}</p>
          </div>
          {active.value === "profile" && <BusinessProfileForm />}
          {active.value === "automation" && <AutomationForm />}
          {active.value === "accounts" && (
            <Card>
              <AccountsList />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
