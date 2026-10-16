"use client";

import { ProfileForm } from "../components/ProfileForm";
import { AccountsSection } from "../components/AccountsSection";
import { ProductsEditor } from "../components/ProductsEditor";

export function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Your business profile and connected social accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-x-10 gap-y-8">
        {/* Profile section */}
        <div className="pt-6">
          <h2 className="text-sm font-semibold text-text">Business profile</h2>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            This information helps AI write better content for your brand.
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
          <ProfileForm />
        </div>

        {/* Divider */}
        <div className="hidden lg:block border-b border-default col-span-full" />

        {/* Products section */}
        <div className="pt-6">
          <h2 className="text-sm font-semibold text-text">Products</h2>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Products and services you offer. These appear as options when creating video content.
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
          <ProductsEditor />
        </div>

        {/* Divider */}
        <div className="hidden lg:block border-b border-default col-span-full" />

        {/* Accounts section */}
        <div className="pt-6">
          <h2 className="text-sm font-semibold text-text">Connected accounts</h2>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Social accounts connected via Upload-Post. Manage connections from the publishing dashboard.
          </p>
        </div>
        <div>
          <AccountsSection />
        </div>
      </div>
    </div>
  );
}
