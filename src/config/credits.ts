// Credits: what clients pay with. 1 credit = $0.10. Admins add credits after a payment (the admin panel);
// every action that costs Prodo money takes its credits. The prices here are the defaults: the live ones are
// in the credit_prices table, which the admin panel edits (Prices).

export type CreditAction =
  | "onboarding"
  | "brand_refresh"
  | "market_refresh"
  | "bible_regenerate"
  | "brand_video"
  | "week_plan"
  | "image_ad"
  | "image_ad_reference"
  | "carousel"
  | "text_post"
  | "video"
  | "video_copy"
  | "social_account";

/** High-level groups for usage screens (nobody wants every single charge) */
export type CreditCategory = "brand" | "plans" | "images" | "videos" | "text" | "accounts";

export const CREDIT_CATEGORIES: { key: CreditCategory; label: string }[] = [
  { key: "images", label: "Images & carousels" },
  { key: "videos", label: "Videos" },
  { key: "plans", label: "Weekly plans" },
  { key: "brand", label: "Brand research" },
  { key: "accounts", label: "Social accounts" },
  { key: "text", label: "Text posts" },
];

export const CREDIT_ACTIONS: Record<CreditAction, { credits: number; label: string; category: CreditCategory }> = {
  onboarding: { credits: 15, label: "Onboarding (website scan and brand research)", category: "brand" },
  brand_refresh: { credits: 10, label: "Refresh brand", category: "brand" },
  market_refresh: { credits: 5, label: "Monthly market refresh", category: "brand" },
  bible_regenerate: { credits: 2, label: "Rewrite the Brand Bible", category: "brand" },
  brand_video: { credits: 1, label: "Video added to brand assets", category: "brand" },
  week_plan: { credits: 2, label: "Plan a week", category: "plans" },
  image_ad: { credits: 8, label: "Image ad", category: "images" },
  image_ad_reference: { credits: 10, label: "Image ad from a reference image", category: "images" },
  carousel: { credits: 8, label: "Carousel", category: "images" },
  text_post: { credits: 2, label: "Text post", category: "text" },
  video: { credits: 70, label: "Video (up to 30 seconds)", category: "videos" },
  video_copy: { credits: 70, label: "Copy a video", category: "videos" },
  social_account: { credits: 60, label: "Social account (per month)", category: "accounts" },
};

export const isCreditAction = (v: unknown): v is CreditAction => typeof v === "string" && v in CREDIT_ACTIONS;

export function categoryOf(action: string | null | undefined): CreditCategory | "other" {
  return isCreditAction(action) ? CREDIT_ACTIONS[action].category : "other";
}

/** What one credit sells for, in US dollars */
export const CREDIT_USD = 0.1;

/** The packs clients buy (a pack gives more credits than its price at $0.10 each) */
export const CREDIT_PACKS = [
  { name: "Starter", usd: 30, credits: 300 },
  { name: "Growth", usd: 80, credits: 900 },
  { name: "Pro", usd: 200, credits: 2500 },
] as const;

/** Credits a new business gets by default: the first pack */
export const DEFAULT_START_CREDITS = CREDIT_PACKS[0].credits;

/** What a payment buys: a pack's credits when it's a pack's price, otherwise $0.10 a credit */
export function creditsForAmount(usd: number): { credits: number; pack: string | null } {
  const pack = CREDIT_PACKS.find((p) => p.usd === usd);
  return pack ? { credits: pack.credits, pack: pack.name } : { credits: Math.round(usd / CREDIT_USD), pack: null };
}

/** Below this the balance shows as low (about one video) */
export const LOW_CREDITS = 70;

export function formatCredits(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en");
}
