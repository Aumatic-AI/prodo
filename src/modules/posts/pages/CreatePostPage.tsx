"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { useMediaItem } from "@/modules/library/hooks/useMedia";
import { useCreatePost, usePublishDraft, usePost, useGenerateCaptions, useImproveCaption } from "../hooks/usePosts";
import { PlatformPreview } from "../components/previews";
import { defaultProvider } from "@/providers/publishing/registry";
import { PLATFORMS } from "@/config/platforms";
import { platformMeta } from "@/modules/dashboard/lib/platforms";
import { urlFor } from "@/providers/storage/supabase-storage";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Send, Clock, FileText, Plus, Sparkles } from "lucide-react";

type WhenOption = "now" | "schedule" | "draft";

export function CreatePostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const { data: draftPost } = usePost(draftId || "");
  const mediaId = searchParams.get("media") || draftPost?.media_id || null;

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const { data: media } = useMediaItem(mediaId);
  const createPost = useCreatePost();
  const publishDraft = usePublishDraft();
  const generateCaptions = useGenerateCaptions();
  const improveCaption = useImproveCaption();
  const submitMutation = draftId ? publishDraft : createPost;

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [improvingPlatform, setImprovingPlatform] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [when, setWhen] = useState<WhenOption>("now");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);

  const seededFromDraft = useRef(false);
  useEffect(() => {
    if (draftPost && !seededFromDraft.current) {
      seededFromDraft.current = true;
      setSelectedAccounts(new Set(draftPost.post_targets.map((t) => t.account_id)));
      setCaptions(Object.fromEntries(draftPost.post_targets.map((t) => [t.platform, t.caption])));
    }
  }, [draftPost]);

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
  const uniquePlatformsKey = uniquePlatforms.join(",");

  useEffect(() => {
    if (!activeTab || !uniquePlatforms.includes(activeTab)) {
      setActiveTab(uniquePlatforms[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniquePlatformsKey, activeTab]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mediaUrl = media?.storage_key ? urlFor(supabaseUrl, media.storage_key) : null;

  async function handleGenerateCaptions() {
    if (!mediaId || !uniquePlatforms.length) return;
    setCaptionError(null);
    try {
      const result = await generateCaptions.mutateAsync({ mediaId, platforms: uniquePlatforms });
      setCaptions((prev) => ({ ...prev, ...result.captions }));
    } catch (e: any) {
      setCaptionError(e.message || "Failed to generate captions");
    }
  }

  async function handleImproveCaption(platform: string) {
    setImprovingPlatform(platform);
    setCaptionError(null);
    try {
      const result = await improveCaption.mutateAsync({ platform, caption: getCaptionForPlatform(platform) });
      setCaptionForPlatform(platform, result.caption);
    } catch (e: any) {
      setCaptionError(e.message || "Failed to improve caption");
    } finally {
      setImprovingPlatform(null);
    }
  }

  async function handleCreate() {
    if (!mediaId || selectedAccountsList.length === 0) return;

    const targets = selectedAccountsList.map((a) => ({
      platform: a.platform,
      account_id: a.id,
      account_name: a.name,
      caption: getCaptionForPlatform(a.platform),
      provider: defaultProvider(),
    }));
    const publish_at = when === "schedule" ? (scheduleDate ? scheduleDate.toISOString() : null) : null;

    if (draftId) {
      await publishDraft.mutateAsync({ id: draftId, action: when, publish_at, targets });
    } else {
      await createPost.mutateAsync({ media_id: mediaId, action: when, publish_at, targets });
    }
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

  const activeAccount = selectedAccountsList.find((a) => a.platform === activeTab);
  const activeCfg = activeTab ? PLATFORMS[activeTab] : undefined;
  const activeCaption = activeTab ? getCaptionForPlatform(activeTab) : "";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">{draftId ? "Edit Draft" : "Create Post"}</h1>
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
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted">No accounts connected.</p>
                <Button
                  size="sm"
                  onClick={() => window.open("https://app.upload-post.com", "_blank", "noopener,noreferrer")}
                >
                  <Plus className="w-4 h-4" />
                  Connect account
                </Button>
              </div>
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
          {uniquePlatforms.length > 0 && activeTab && (
            <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
              <h3 className="text-sm font-semibold text-text mb-4">Captions</h3>

              {/* Platform tabs */}
              <div className="flex flex-wrap gap-2 mb-5">
                {uniquePlatforms.map((platform) => {
                  const meta = platformMeta(platform);
                  const Icon = meta?.icon;
                  const active = activeTab === platform;
                  return (
                    <button
                      key={platform}
                      onClick={() => setActiveTab(platform)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors",
                        active ? "bg-primary text-on-primary" : "bg-page text-muted hover:text-text"
                      )}
                      style={{ padding: "6px 12px" }}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {meta?.label || PLATFORMS[platform]?.label || platform}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text">
                      {activeCfg?.label || activeTab} caption
                    </label>
                    {activeCaption.trim() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImproveCaption(activeTab)}
                        loading={improvingPlatform === activeTab}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Improve with AI
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateCaptions}
                        loading={generateCaptions.isPending}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate with AI
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={activeCaption}
                    onChange={(e) => setCaptionForPlatform(activeTab, e.target.value)}
                    placeholder={`Write a caption for ${activeCfg?.label || activeTab}...`}
                    maxLength={activeCfg?.captionMaxLength}
                    hint={`${activeCaption.length} / ${activeCfg?.captionMaxLength || "∞"}`}
                    className="min-h-[200px]"
                  />
                </div>

                <div className="flex items-start justify-center pt-1">
                  <PlatformPreview
                    platform={activeTab as any}
                    account={{
                      displayName: activeAccount?.name || "your_account",
                      avatarUrl: activeAccount?.avatarUrl,
                    }}
                    caption={activeCaption}
                    mediaUrl={mediaUrl}
                    mediaType={media?.type}
                  />
                </div>
              </div>

              {captionError && (
                <p className="mt-4 text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{captionError}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: when + submit */}
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">When</h3>
            <div className="space-y-2.5">
              {([
                { value: "now", label: "Publish now", icon: Send },
                { value: "schedule", label: "Schedule", icon: Clock },
                { value: "draft", label: "Save as draft", icon: FileText },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setWhen(value)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg border text-left transition-colors",
                    when === value
                      ? "border-primary bg-primary-subtle"
                      : "border-default hover:bg-surface-hover"
                  )}
                  style={{ padding: "14px 16px" }}
                >
                  <Icon className="w-4 h-4 text-muted shrink-0" />
                  <span className="text-sm font-medium text-text">{label}</span>
                </button>
              ))}
            </div>
            {when === "schedule" && (
              <DateTimePicker
                value={scheduleDate}
                onChange={setScheduleDate}
                minDate={new Date()}
                maxDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
                className="mt-3"
              />
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            loading={submitMutation.isPending}
            disabled={!mediaId || selectedAccounts.size === 0}
          >
            {when === "draft" ? "Save draft" : when === "schedule" ? "Schedule post" : "Publish now"}
          </Button>

          {submitMutation.error && (
            <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
              {submitMutation.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
