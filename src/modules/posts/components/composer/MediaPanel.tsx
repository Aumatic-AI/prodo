import Link from "next/link";
import { FileText, GalleryHorizontal, ImageIcon, Repeat, Video } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import type { PostMedia } from "../../hooks/usePosts";

const TYPE = {
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: Video },
  carousel: { label: "Carousel", icon: GalleryHorizontal },
  text: { label: "Text", icon: FileText },
} as const;

/** The media being posted: a filmstrip of what goes out, its type and the idea behind it. */
export function MediaPanel({ media, urls, loading }: { media: PostMedia | undefined; urls: string[]; loading: boolean }) {
  if (loading || !media) return <Skeleton className="h-36" />;
  const { label, icon: Icon } = TYPE[media.type];

  return (
    <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs sm:flex-row">
      <div className="flex gap-2 overflow-x-auto sm:max-w-[55%]">
        {media.type === "text" ? (
          <div className="flex h-32 w-56 shrink-0 flex-col gap-2 rounded-ob-md bg-linear-to-br from-ob-primary-soft to-ob-surface p-3.5">
            <FileText size={16} className="text-ob-primary" />
            <p className="m-0 line-clamp-4 text-[13px] text-ob-ink-soft">{media.content || media.idea}</p>
          </div>
        ) : (
          urls.map((url, i) =>
            media.type === "video" ? (
              <video key={url} src={`${url}#t=0.5`} muted playsInline preload="metadata" className="h-32 w-[72px] shrink-0 rounded-ob-md bg-ob-dark object-cover" />
            ) : (
              <div key={`${url}-${i}`} className="relative h-32 shrink-0 overflow-hidden rounded-ob-md bg-ob-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-auto max-w-[200px] object-cover" />
                {urls.length > 1 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ob-dark/70 px-1.5 text-[11px] font-bold text-ob-on-dark">{i + 1}</span>}
              </div>
            )
          )
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary" size="sm">
            <Icon size={12} /> {label}
            {media.type === "carousel" && urls.length > 1 ? ` · ${urls.length} slides` : ""}
          </Badge>
          {media.aspect_ratio && <Badge size="sm">{media.aspect_ratio}</Badge>}
          {media.duration_sec && media.type === "video" ? <Badge size="sm">{media.duration_sec}s</Badge> : null}
        </div>
        {media.idea && <p className="m-0 line-clamp-3 text-sm text-ob-ink-soft">{media.idea}</p>}
        <Link href="/media" className={`${button({ variant: "quiet", size: "xs" })} mt-auto self-start`}>
          <Repeat size={14} /> Use different media
        </Link>
      </div>
    </section>
  );
}
