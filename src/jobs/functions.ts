import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { publishPost } from "./publish-post";
import { checkPostStatus } from "./check-post-status";
import { onboardingRun, regenerateBible } from "./onboarding-run";
import { websiteAnalyst } from "@/agents/website-analyst";
import { visualIdentityAnalyst } from "@/agents/visual-identity";
import { socialMarketAnalyst } from "@/agents/social-market";
import { brandStrategist } from "@/agents/brand-strategist";
import { planner } from "@/agents/planner";
import { produceItem } from "@/agents/weekly/produce-item";
import { autoApprove, firstPlan, onItemSettled, weeklyPlanCron } from "@/agents/weekly/plan-flow";
import { publishItem, publishPlan } from "@/agents/publisher";
import { metricsSync } from "@/agents/performance-analyst/sync";
import { weeklyLearnings } from "@/agents/performance-analyst/learn";
import { monthlyRefresh } from "./monthly-refresh";
import { applyPause } from "./apply-pause";

export const functions = [
  // Manual create and publish
  generateImage,
  generateVideo,
  publishPost,
  checkPostStatus,
  // Brand research (agents 1–4)
  onboardingRun,
  regenerateBible,
  websiteAnalyst,
  visualIdentityAnalyst,
  socialMarketAnalyst,
  brandStrategist,
  // Weekly loop (agents 5–9)
  weeklyPlanCron,
  firstPlan,
  planner,
  produceItem,
  onItemSettled,
  autoApprove,
  publishPlan,
  publishItem,
  // Learning loop (agent 10)
  metricsSync,
  weeklyLearnings,
  // Housekeeping
  monthlyRefresh,
  applyPause,
];
