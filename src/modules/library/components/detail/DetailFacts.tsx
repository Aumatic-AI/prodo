import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { STATUS_META, TYPE_META, fullDate, money } from "../../lib/display";
import type { MediaListItem } from "../../types";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-ob-muted">{label}</dt>
      <dd className="m-0 text-right text-[13.5px] font-semibold text-ob-ink">{children}</dd>
    </div>
  );
}

/** What was asked for and what it cost. */
export function DetailFacts({ media }: { media: MediaListItem }) {
  const isVideo = media.type === "video";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="dark" size="sm">
          {TYPE_META[media.type].label}
        </Badge>
        <Badge tone={STATUS_META[media.status].tone} size="sm">
          {STATUS_META[media.status].label}
        </Badge>
        {media.plan_item_id && (
          <Badge tone="primary" size="sm">
            <Bot size={12} /> Made by Prodo
          </Badge>
        )}
        {media.source === "uploaded" && <Badge size="sm">Uploaded</Badge>}
      </div>

      {media.idea && media.type !== "text" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">Idea</span>
          <p className="m-0 text-[14.5px] leading-relaxed text-ob-ink-soft">{media.idea}</p>
        </div>
      )}

      <dl className="m-0 divide-y divide-ob-line rounded-ob-md border border-ob-line bg-ob-surface px-4">
        {media.product_name && <Fact label="Product">{media.product_name}</Fact>}
        {media.aspect_ratio && <Fact label="Size">{media.aspect_ratio}</Fact>}
        {isVideo && media.duration_sec && <Fact label="Length">{media.duration_sec} sec</Fact>}
        {isVideo && <Fact label="Voice">{media.voice_name || (media.audio_style === "No Voice" ? "No voice" : "Default")}</Fact>}
        {isVideo && media.language && <Fact label="Language">{media.language}</Fact>}
        {media.type === "image" && media.use_logo != null && <Fact label="Logo">{media.use_logo ? "Added" : "Not added"}</Fact>}
        {media.reference_image_key && <Fact label="Reference photo">Used</Fact>}
        <Fact label="Cost">{money(media.cost_usd)}</Fact>
        <Fact label="Created">{fullDate(media.created_at)}</Fact>
      </dl>

      {media.status === "failed" && media.error && <p className="m-0 rounded-ob-md bg-ob-danger-soft px-4 py-3 text-sm text-ob-danger">{media.error}</p>}
    </div>
  );
}
