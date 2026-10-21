"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tabs } from "@/components/ui/Tabs";
import { VoiceExplorerModal } from "@/components/global/VoiceExplorerModal";
import { useGenerateMedia, useUploadReferenceImage } from "../../hooks/useMedia";
import { useProfile } from "@/modules/settings/hooks/useProfile";
import { IdeaField } from "./IdeaField";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import {
  ASPECT_RATIOS,
  DURATIONS,
  AUDIO_STYLES,
  CHARACTERS,
  VIDEO_TYPES,
  LANGUAGES,
} from "@/config/video-options";
import { Mic } from "lucide-react";

export function VideoTab({ onSuccess }: { onSuccess: () => void }) {
  const [idea, setIdea] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("30");
  const [product, setProduct] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [audioStyle, setAudioStyle] = useState("Voiceover");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [character, setCharacter] = useState("female");
  const [videoType, setVideoType] = useState("promotional");
  const [language, setLanguage] = useState("en");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);

  const generate = useGenerateMedia();
  const uploadRef = useUploadReferenceImage();
  const { data: profile } = useProfile();

  function handleRefSelect(file: File | null) {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefFile(file);
    setRefPreview(file ? URL.createObjectURL(file) : null);
  }

  const products: { value: string; label: string }[] = (profile as any)?.products
    ? (profile as any).products.map((p: any) => ({ value: typeof p === "string" ? p : p.name, label: typeof p === "string" ? p : p.name }))
    : [];

  const resolvedProduct = product === "__other__" ? customProduct : product;

  async function handleCreate() {
    let referenceImageKey: string | undefined;
    if (refFile) {
      const result = await uploadRef.mutateAsync(refFile);
      referenceImageKey = result.key;
    }

    const hasVoice = audioStyle === "Voiceover";

    await generate.mutateAsync({
      type: "video",
      idea,
      aspect_ratio: aspectRatio,
      duration_sec: parseInt(duration),
      product: resolvedProduct || undefined,
      audio_style: audioStyle,
      voice_id: hasVoice ? voiceId || undefined : undefined,
      voice_name: hasVoice ? voiceName || undefined : undefined,
      character: hasVoice ? character : undefined,
      video_type: videoType,
      language,
      reference_image_key: referenceImageKey,
    });
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <IdeaField
        value={idea}
        onChange={setIdea}
        format="video"
        placeholder="A short testimonial-style video about your product's impact..."
        required
      />

      <SegmentedControl
        label="Aspect ratio"
        options={ASPECT_RATIOS}
        value={aspectRatio}
        onChange={setAspectRatio}
      />

      <div className="grid grid-cols-2 gap-4">
        <Dropdown
          label="Duration"
          options={DURATIONS}
          value={duration}
          onChange={setDuration}
        />
        <Dropdown
          label="Video type"
          options={VIDEO_TYPES}
          value={videoType}
          onChange={setVideoType}
        />
      </div>

      <div>
        <Dropdown
          label="Product"
          required
          options={[
            ...products,
            { value: "__other__", label: "Other" },
          ]}
          value={product}
          onChange={(v) => { setProduct(v); if (v !== "__other__") setCustomProduct(""); }}
          placeholder="Select a product..."
        />
        {product === "__other__" && (
          <Input
            className="mt-2"
            placeholder="Enter product or service name..."
            value={customProduct}
            onChange={(e) => setCustomProduct(e.target.value)}
          />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-text mb-2">Audio style</p>
        <Tabs
          tabs={AUDIO_STYLES.map((s) => ({ value: s.value, label: s.label }))}
          value={audioStyle}
          onChange={setAudioStyle}
        />
      </div>

      {audioStyle === "Voiceover" && (
        <div>
          <p className="text-sm font-medium text-text mb-2">Voice</p>
          <button
            type="button"
            onClick={() => setShowVoiceModal(true)}
            className="flex items-center gap-3 w-full rounded-lg border border-default hover:border-strong transition-colors"
            style={{ padding: "10px 14px", backgroundColor: "var(--color-page)" }}
          >
            <Mic className="w-4 h-4 text-secondary" />
            <span className={voiceName ? "text-sm text-text" : "text-sm text-secondary"}>
              {voiceName || "Choose a voice..."}
            </span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {audioStyle === "Voiceover" && (
          <Dropdown
            label="Character"
            options={CHARACTERS}
            value={character}
            onChange={setCharacter}
          />
        )}
        <Dropdown
          label="Language"
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
        />
      </div>

      <ReferenceImagePicker
        preview={refPreview}
        onSelect={handleRefSelect}
        hint="Upload a product or person photo to keep it consistent across every scene."
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleCreate}
          loading={uploadRef.isPending || generate.isPending}
          disabled={!idea.trim() || !resolvedProduct.trim() || uploadRef.isPending || generate.isPending}
        >
          Generate Video
        </Button>
      </div>

      {(uploadRef.error || generate.error) && (
        <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
          {uploadRef.error?.message || generate.error?.message}
        </p>
      )}

      <VoiceExplorerModal
        open={showVoiceModal}
        onOpenChange={setShowVoiceModal}
        selectedVoiceId={voiceId}
        onSelectVoice={(id, name) => { setVoiceId(id); setVoiceName(name); }}
      />
    </div>
  );
}
