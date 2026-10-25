import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { publishPost } from "./publish-post";
import { checkPostStatus } from "./check-post-status";
import { onboardingRun, regenerateBible } from "./onboarding-run";
import { websiteAnalyst } from "@/agents/website-analyst";
import { visualIdentityAnalyst } from "@/agents/visual-identity";
import { socialMarketAnalyst } from "@/agents/social-market";
import { brandStrategist } from "@/agents/brand-strategist";

export const functions = [
  generateImage,
  generateVideo,
  publishPost,
  checkPostStatus,
  onboardingRun,
  regenerateBible,
  websiteAnalyst,
  visualIdentityAnalyst,
  socialMarketAnalyst,
  brandStrategist,
];
