import Link from "next/link";
import { ExternalLink, FileText, Play } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { Card } from "@/components/kit/Card";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { PerformanceView } from "@/core/performance/dashboard";
import { platformMeta } from "@/config/platforms";
import { num, pct } from "../../lib/format";

type Post = PerformanceView["topPosts"][number];

function Thumb({ media }: { media: Post["media"] }) {
  const url = media?.storage_key ? publicUrl(media.storage_key) : null;
  if (url && media?.type === "video") {
    return (
      <div className="relative size-full bg-ob-dark">
        <video src={`${url}#t=0.8`} muted playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 grid size-6 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
          <Play size={11} fill="currentColor" />
        </span>
      </div>
    );
  }
  if (url && media?.type !== "text") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />;
  }
  return (
    <div className="grid size-full place-items-center bg-linear-to-br from-ob-primary-soft to-ob-surface text-ob-primary">
      <FileText size={22} />
    </div>
  );
}

/** The best posts of the period, against each platform's usual engagement. */
export function TopPosts({ posts }: { posts: Post[] }) {
  return (
    <Card title="Top posts" description="Highest engagement against what's usual on each platform.">
      {posts.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p, i) => {
            const meta = platformMeta(p.platform);
            const Icon = meta.icon;
            return (
              <li key={`${p.postId}-${p.platform}`}>
                <Link
                  href={`/posts/${p.postId}`}
                  className="group flex h-full flex-col overflow-hidden rounded-ob-md border border-ob-line bg-ob-surface transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-ob-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-ob-sunken">
                    <Thumb media={p.media} />
                    <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-ob-surface text-[12px] font-extrabold text-ob-ink shadow-ob-sm">{i + 1}</span>
                    <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-ob text-ob-on-dark ring-2 ring-ob-surface" style={{ backgroundColor: meta.color }} title={meta.label}>
                      <Icon size={14} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="m-0 line-clamp-2 text-[13px] leading-snug text-ob-ink">{p.caption || "No caption"}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ob-muted">
                      <span>
                        <strong className="tabular-nums text-ob-ink">{pct(p.er, 1)}</strong> eng.
                      </span>
                      <span>
                        <strong className="tabular-nums text-ob-ink">{num(p.reach)}</strong> reach
                      </span>
                      {p.origin === "agent" && (
                        <Badge tone="primary" size="sm">
                          By Prodo
                        </Badge>
                      )}
                      {p.url && <ExternalLink size={12} className="ml-auto text-ob-faint" aria-label="Has a live link" />}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ob-muted">Numbers for posts appear the day after they go live.</p>
      )}
    </Card>
  );
}
