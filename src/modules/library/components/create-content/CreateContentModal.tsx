"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Upload, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/kit/Modal";
import { focusRing } from "@/components/kit/styles";
import { ImageTab } from "./ImageTab";
import { TextTab } from "./TextTab";
import { UploadTab } from "./UploadTab";
import { VideoTab } from "./VideoTab";

export type CreateTab = "image" | "video" | "text" | "upload";

const TABS: { value: CreateTab; label: string; text: string; icon: LucideIcon }[] = [
  { value: "image", label: "Image", text: "AI photo", icon: ImageIcon },
  { value: "video", label: "Video", text: "Reel with voice", icon: Video },
  { value: "text", label: "Text", text: "Written post", icon: FileText },
  { value: "upload", label: "Upload", text: "Your own files", icon: Upload },
];

/** Make something new: AI image, AI video, a text post, or upload files. */
export function CreateContentModal({ initialTab, onClose }: { initialTab: CreateTab; onClose: () => void }) {
  const [tab, setTab] = useState<CreateTab>(initialTab);

  const toolbar = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="What to create">
      {TABS.map(({ value, label, text, icon: Icon }) => {
        const on = tab === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-2.5 rounded-ob-md border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
              focusRing,
              on ? "border-ob-primary bg-ob-primary-soft shadow-[inset_0_0_0_1px_var(--color-ob-primary)]" : "border-ob-line bg-ob-surface hover:border-ob-line-strong"
            )}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-ob transition-colors", on ? "bg-ob-primary text-ob-on-primary" : "bg-ob-sunken text-ob-muted")}>
              <Icon size={16} />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-bold text-ob-ink">{label}</span>
              <span className="truncate text-xs text-ob-muted">{text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Create content" description="Made in the background. It shows up in your library when ready." toolbar={toolbar} className="w-[min(calc(100vw-32px),760px)]">
      {tab === "image" && <ImageTab onDone={onClose} />}
      {tab === "video" && <VideoTab onDone={onClose} />}
      {tab === "text" && <TextTab onDone={onClose} />}
      {tab === "upload" && <UploadTab onDone={onClose} />}
    </Modal>
  );
}
