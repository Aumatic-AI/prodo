import { FacebookPreview } from "./FacebookPreview";
import { InstagramPreview } from "./InstagramPreview";
import { LinkedInPreview } from "./LinkedInPreview";
import { TikTokPreview } from "./TikTokPreview";
import { XPreview } from "./XPreview";
import type { PlatformPreviewProps } from "./types";

/** How the post will look in the platform's feed. Unknown platforms fall back to a neutral card. */
export function PlatformPreview(props: PlatformPreviewProps) {
  switch (props.platform) {
    case "facebook":
      return <FacebookPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "tiktok":
      return <TikTokPreview {...props} />;
    case "youtube":
      return <TikTokPreview {...props} shorts />;
    default:
      return <XPreview {...props} />;
  }
}

export type { PlatformPreviewProps, PreviewAccount, PreviewMediaType } from "./types";
