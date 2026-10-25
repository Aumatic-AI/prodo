import {
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  Eye,
  Hammer,
  PenLine,
  Radio,
  SearchCheck,
  SkipForward,
  Sparkles,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ItemStatus, PlanStatus } from "@/core/plans/types";

type Tone = "neutral" | "primary" | "success" | "warn" | "danger" | "dark";

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone; icon: LucideIcon; working?: boolean }> = {
  planned: { label: "Writing brief", tone: "primary", icon: PenLine, working: true },
  briefed: { label: "Brief ready", tone: "primary", icon: Sparkles, working: true },
  producing: { label: "Making", tone: "primary", icon: Hammer, working: true },
  qa: { label: "Checking", tone: "primary", icon: SearchCheck, working: true },
  ready: { label: "Ready to approve", tone: "success", icon: Eye },
  needs_review: { label: "Needs a look", tone: "warn", icon: TriangleAlert },
  approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
  rejected: { label: "Skipped", tone: "neutral", icon: SkipForward },
  scheduled: { label: "Scheduled", tone: "dark", icon: CalendarCheck },
  published: { label: "Live", tone: "success", icon: Radio },
  failed: { label: "Failed", tone: "danger", icon: XCircle },
};

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: Tone }> = {
  planning: { label: "Planning", tone: "primary" },
  producing: { label: "Making posts", tone: "primary" },
  review: { label: "Ready for review", tone: "success" },
  approved: { label: "Approved", tone: "success" },
  scheduled: { label: "Scheduled", tone: "dark" },
  done: { label: "Done", tone: "neutral" },
  failed: { label: "Stopped", tone: "danger" },
};

export const AGENT_NAMES: Record<string, string> = {
  website_analyst: "Website Analyst",
  visual_identity_analyst: "Visual Identity",
  social_market_analyst: "Social & Market",
  brand_strategist: "Brand Strategist",
  planner: "Planner",
  creative_director: "Creative Director",
  producer: "Producer",
  qa_critic: "QA Critic",
  publisher: "Publisher",
  performance_analyst: "Performance Analyst",
};

export const PENDING_ICON = CircleDashed;
