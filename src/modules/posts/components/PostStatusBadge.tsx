import { Badge } from "@/components/kit/Badge";
import type { PostStatus } from "@/core/posts";
import { POST_STATUS } from "../lib/format";

export function PostStatusBadge({ status, size = "sm" }: { status: PostStatus; size?: "sm" | "md" }) {
  const { label, tone } = POST_STATUS[status];
  return (
    <Badge tone={tone} size={size}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
