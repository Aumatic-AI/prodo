"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/components/ui/UnsavedChangesBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LogoPicker } from "./LogoPicker";
import { useProfile, useSaveProfile } from "../hooks/useProfile";
import { urlFor } from "@/providers/storage/supabase-storage";
import { LIMITS } from "@/config/limits";

interface FormState {
  name: string;
  website: string;
  about: string;
}

export function ProfileForm() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  const saveMutation = useSaveProfile();

  const [form, setForm] = useState<FormState>({ name: "", website: "", about: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const saved = useMemo<FormState>(
    () => ({
      name: profile?.name || "",
      website: profile?.website || "",
      about: profile?.about || "",
    }),
    [profile]
  );

  useEffect(() => {
    if (profile) setForm(saved);
  }, [profile, saved]);

  const hasChanges =
    form.name !== saved.name ||
    form.website !== saved.website ||
    form.about !== saved.about ||
    logoFile !== null;

  function handleLogoSelect(file: File | null) {
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function discard() {
    setForm(saved);
    handleLogoSelect(null);
  }

  async function save() {
    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("website", form.website);
    fd.set("about", form.about);
    if (logoFile) fd.set("logo", logoFile);
    await saveMutation.mutateAsync(fd);
    setLogoFile(null);
    setLogoPreview(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState message="Failed to load profile" onRetry={() => refetch()} />;

  const logoUrl = profile?.logo_key
    ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, profile.logo_key)
    : null;

  return (
    <>
      <div className="space-y-6 max-w-xl">
        <LogoPicker
          currentUrl={logoUrl}
          previewUrl={logoPreview}
          onSelect={handleLogoSelect}
        />

        <Input
          id="name"
          label="Business name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Your business name"
        />

        <Input
          id="website"
          label="Website"
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          placeholder="https://example.com"
        />

        <Textarea
          id="about"
          label="About the business"
          hint={`${form.about.length} / ${LIMITS.aboutMaxChars}`}
          value={form.about}
          onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
          placeholder="Describe your business, services, target audience, and anything that helps AI write better content for you..."
          maxLength={LIMITS.aboutMaxChars}
          className="min-h-[180px]"
        />
      </div>

      <UnsavedChangesBar
        show={hasChanges}
        loading={saveMutation.isPending}
        onSave={save}
        onDiscard={discard}
      />
    </>
  );
}
