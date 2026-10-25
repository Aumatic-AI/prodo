import Link from "next/link";
import { ArrowUpRight, FileText, GalleryHorizontal, Image as ImageIcon, Video } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { CostsView } from "@/core/performance/costs";
import { usd } from "../../lib/format";

const TYPE = { image: { label: "Image", icon: ImageIcon }, video: { label: "Video", icon: Video }, carousel: { label: "Carousel", icon: GalleryHorizontal }, text: { label: "Text", icon: FileText } } as const;

/** The most expensive assets this month, with what they were and where to find them. */
export function AssetTable({ items }: { items: CostsView["byMedia"] }) {
  return (
    <Card title="Most expensive assets" description="Every image, voice, clip, render and check that went into each one.">
      {items.length ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
          {items.slice(0, 12).map((m) => {
            const t = TYPE[m.type as keyof typeof TYPE] ?? TYPE.image;
            const Icon = t.icon;
            const url = m.storage_key && m.type !== "video" && m.type !== "text" ? publicUrl(m.storage_key) : null;
            const row = (
              <>
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-ob bg-ob-sunken text-ob-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url ? <img src={url} alt="" className="size-full object-cover" /> : <Icon size={18} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-ob-ink">{m.idea ?? "Untitled"}</span>
                  <span className="flex items-center gap-2 text-[12px] text-ob-muted">
                    {t.label}
                    {m.status !== "ready" && <span className="text-ob-faint">· {m.status}</span>}
                    {m.planItemId && <ArrowUpRight size={12} className="text-ob-primary" />}
                  </span>
                </span>
                <strong className="shrink-0 text-[14px] tabular-nums">{usd(m.cost)}</strong>
              </>
            );
            return (
              <li key={m.mediaId}>
                {m.planItemId ? (
                  <Link href={`/week?item=${m.planItemId}`} className="flex items-center gap-3 rounded-ob px-1 py-2.5 transition-colors hover:bg-ob-sunken">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-1 py-2.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ob-muted">No assets made this month.</p>
      )}
    </Card>
  );
}
