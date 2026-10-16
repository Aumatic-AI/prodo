"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useGenerateMedia } from "../../hooks/useMedia";
import { useProfile } from "@/modules/settings/hooks/useProfile";
import { IdeaField } from "./IdeaField";
import { ASPECT_RATIOS } from "@/config/video-options";

export function ImageTab({ onSuccess }: { onSuccess: () => void }) {
  const [idea, setIdea] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [useLogo, setUseLogo] = useState(true);
  const generate = useGenerateMedia();
  const { data: profile } = useProfile();
  const hasLogo = !!profile?.logo_key;

  async function handleCreate() {
    await generate.mutateAsync({
      type: "image",
      idea,
      aspect_ratio: aspectRatio,
      use_logo: useLogo,
    });
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <IdeaField
        value={idea}
        onChange={setIdea}
        format="image"
        placeholder="A vibrant lifestyle photo showcasing your brand in action..."
        required
      />

      <SegmentedControl
        label="Aspect ratio"
        options={ASPECT_RATIOS}
        value={aspectRatio}
        onChange={setAspectRatio}
      />

      {hasLogo && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Add business logo</span>
          <Switch checked={useLogo} onCheckedChange={setUseLogo} />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleCreate}
          loading={generate.isPending}
          disabled={!idea.trim()}
        >
          Generate Image
        </Button>
      </div>

      {generate.error && (
        <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{generate.error.message}</p>
      )}
    </div>
  );
}
