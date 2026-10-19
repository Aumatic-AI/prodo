import { FacebookPreview } from "./FacebookPreview";
import { InstagramPreview } from "./InstagramPreview";
import { LinkedInPreview } from "./LinkedInPreview";
import { XPreview } from "./XPreview";
import { TikTokPreview } from "./TikTokPreview";
import type { PlatformPreviewProps } from "./types";

export function PlatformPreview(props: PlatformPreviewProps) {
  switch (props.platform) {
    case "facebook":
      return <FacebookPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "twitter":
      return <XPreview {...props} />;
    case "tiktok":
      return <TikTokPreview {...props} />;
    default:
      return null;
  }
}

export type { PlatformPreviewProps, PreviewAccount } from "./types";
