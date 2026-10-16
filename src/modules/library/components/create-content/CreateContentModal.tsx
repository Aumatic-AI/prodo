"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs } from "@/components/ui/Tabs";
import { ImageTab } from "./ImageTab";
import { VideoTab } from "./VideoTab";
import { TextTab } from "./TextTab";
import { UploadTab } from "./UploadTab";

interface CreateContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "text", label: "Text" },
  { value: "upload", label: "Upload" },
];

export function CreateContentModal({ open, onOpenChange }: CreateContentModalProps) {
  const [tab, setTab] = useState("image");

  function handleSuccess() {
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Content"
      description="Generate images, videos, or text posts with AI — or upload your own."
      className="max-w-[600px]"
    >
      <div className="space-y-5">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === "image" && <ImageTab onSuccess={handleSuccess} />}
        {tab === "video" && <VideoTab onSuccess={handleSuccess} />}
        {tab === "text" && <TextTab onSuccess={handleSuccess} />}
        {tab === "upload" && <UploadTab onSuccess={handleSuccess} />}
      </div>
    </Dialog>
  );
}
