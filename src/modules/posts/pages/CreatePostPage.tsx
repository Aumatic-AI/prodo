"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { useCreatePost } from "../hooks/usePosts";
import { defaultProvider } from "@/providers/publishing/registry";
import { PLATFORMS } from "@/config/platforms";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Send, Clock, FileText } from "lucide-react";

type WhenOption = "now" | "schedule" | "draft";

export function CreatePostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mediaId = searchParams.get("media");

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const createPost = useCreatePost();

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [when, setWhen] = useState<WhenOption>("now");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getCaptionForPlatform(platform: string) {
    return captions[platform] || "";
  }

  function setCaptionForPlatform(platform: string, text: string) {
    setCaptions((prev) => ({ ...prev, [platform]: text }));
  }

  const selectedAccountsList = accounts?.filter((a) => selectedAccounts.has(a.id)) || [];
  const uniquePlatforms = [...new Set(selectedAccountsList.map((a) => a.platform))];

  async function handleCreate() {
    if (!mediaId || selectedAccountsList.length === 0) return;

    const targets = selectedAccountsList.map((a) => ({
      platform: a.platform,
      account_id: a.id,
      account_name: a.name,
      caption: getCaptionForPlatform(a.platform),
      provider: defaultProvider(),
    }));

    await createPost.mutateAsync({
      media_id: mediaId,
      publish_at: when === "schedule" ? scheduleDate || null : null,
      targets,
    });
    router.push("/posts");
  }

  if (!mediaId) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted">Select a media item from the library first.</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/media")}>
          Go to Media
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">Create Post</h1>
          <p className="mt-0.5 text-sm text-muted">Pick accounts, write captions, and publish.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: accounts + captions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Accounts */}
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Select accounts</h3>
            {accountsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : accountsError ? (
              <ErrorState message="Failed to load accounts" />
            ) : !accounts?.length ? (
              <p className="text-sm text-muted">No accounts connected.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => {
                  const selected = selectedAccounts.has(account.id);
                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 rounded-lg border text-left transition-colors",
                        selected
                          ? "border-primary bg-primary-subtle"
                          : "border-default hover:bg-surface-hover"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                        selected ? "border-primary bg-primary" : "border-default"
                      )}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{account.name}</p>
                        <p className="text-xs text-secondary capitalize">{account.platform}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Captions */}
          {uniquePlatforms.length > 0 && (
            <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
              <h3 className="text-sm font-semibold text-text mb-4">Captions</h3>
              <div className="space-y-4">
                {uniquePlatforms.map((platform) => {
                  const cfg = PLATFORMS[platform];
                  return (
                    <Textarea
                      key={platform}
                      label={cfg?.label || platform}
                      hint={`${getCaptionForPlatform(platform).length} / ${cfg?.captionMaxLength || "∞"}`}
                      value={getCaptionForPlatform(platform)}
                      onChange={(e) => setCaptionForPlatform(platform, e.target.value)}
                      placeholder={`Write a caption for ${cfg?.label || platform}...`}
                      maxLength={cfg?.captionMaxLength}
                      className="min-h-[100px]"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: when + submit */}
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">When</h3>
            <div className="space-y-2">
              {([
                { value: "now", label: "Publish now", icon: Send },
                { value: "schedule", label: "Schedule", icon: Clock },
                { value: "draft", label: "Save as draft", icon: FileText },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setWhen(value)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-lg border text-left transition-colors",
                    when === value
                      ? "border-primary bg-primary-subtle"
                      : "border-default hover:bg-surface-hover"
                  )}
                >
                  <Icon className="w-4 h-4 text-muted" />
                  <span className="text-sm font-medium text-text">{label}</span>
                </button>
              ))}
            </div>
            {when === "schedule" && (
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="mt-3 w-full h-10 px-3 text-sm rounded-lg border border-default bg-page text-text"
              />
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            loading={createPost.isPending}
            disabled={!mediaId || selectedAccounts.size === 0}
          >
            {when === "draft" ? "Save draft" : when === "schedule" ? "Schedule post" : "Publish now"}
          </Button>

          {createPost.error && (
            <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
              {createPost.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
