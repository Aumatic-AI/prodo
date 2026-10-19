"use client";

import { useState } from "react";
import { ProfileForm } from "../components/ProfileForm";
import { AccountsSection } from "../components/AccountsSection";
import { ProductsEditor } from "../components/ProductsEditor";
import { cn } from "@/lib/utils";
import { Building2, Package, Users } from "lucide-react";

const TABS = [
  {
    value: "profile",
    label: "Business profile",
    icon: Building2,
    description: "This information helps AI write better content for your brand.",
  },
  {
    value: "products",
    label: "Products",
    icon: Package,
    description: "Products and services you offer. These appear as options when creating video content.",
  },
  {
    value: "accounts",
    label: "Connected accounts",
    icon: Users,
    description: "Social accounts connected via Upload-Post. Manage connections from the publishing dashboard.",
  },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function SettingsPage() {
  const [tab, setTab] = useState<TabValue>("profile");
  const active = TABS.find((t) => t.value === tab)!;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Your business profile and connected social accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Sidebar */}
        <nav className="flex lg:flex-col gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg text-sm font-medium text-left transition-colors",
                  isActive
                    ? "bg-primary text-on-primary"
                    : "text-muted hover:bg-surface-hover hover:text-text"
                )}
                style={{ padding: "10px 14px" }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div>
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-text">{active.label}</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">{active.description}</p>
          </div>

          {tab === "profile" && (
            <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
              <ProfileForm />
            </div>
          )}

          {tab === "products" && (
            <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
              <ProductsEditor />
            </div>
          )}

          {tab === "accounts" && <AccountsSection />}
        </div>
      </div>
    </div>
  );
}
