"use client";

import { ArrowRight, FileText, Image as ImageIcon, Upload, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";
import type { CreateTab } from "./create-content/CreateContentModal";

const STARTS: { tab: CreateTab; icon: LucideIcon; title: string; text: string }[] = [
  { tab: "image", icon: ImageIcon, title: "Make an image", text: "Describe a photo; your logo goes on top." },
  { tab: "video", icon: Video, title: "Make a video", text: "A short reel with scenes and a voice-over." },
  { tab: "text", icon: FileText, title: "Write a text post", text: "For LinkedIn, X or a quick update." },
  { tab: "upload", icon: Upload, title: "Upload your own", text: "Photos and videos you already have." },
];

/** First-visit screen: four ways to add content. */
export function QuickStart({ onStart }: { onStart: (tab: CreateTab) => void }) {
  return (
    <section className="flex flex-col items-center gap-6 rounded-ob-lg border border-dashed border-ob-line-strong bg-ob-surface px-6 py-12 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-xl font-extrabold tracking-tight">Your media library is empty</h2>
        <p className="m-0 text-[15px] text-ob-muted">Everything you make or upload lands here, ready to post. Agents add theirs too.</p>
      </div>
      <div className="grid w-full max-w-[880px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STARTS.map(({ tab, icon: Icon, title, text }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onStart(tab)}
            className={cn(
              "group flex flex-col items-start gap-3 rounded-ob-md border border-ob-line bg-ob-bg p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ob-primary hover:shadow-ob-md",
              focusRing
            )}
          >
            <span className="grid size-10 place-items-center rounded-ob bg-ob-primary-soft text-ob-primary transition-colors group-hover:bg-ob-primary group-hover:text-ob-on-primary">
              <Icon size={19} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-[15px] font-bold text-ob-ink">
                {title}
                <ArrowRight size={14} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className="text-[13px] text-ob-muted">{text}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
