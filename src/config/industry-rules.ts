import type { Industry } from "@/core/onboarding/options";

// Words ads in sensitive industries must never use: claims platforms and regulators reject unless
// proven. Added to the client's own never-say list when the Brand Bible is written.

export const INDUSTRY_NEVER_SAY: Partial<Record<Industry, string[]>> = {
  health: ["cure", "cures", "heals", "treats", "guaranteed results", "miracle", "100% effective", "no side effects", "clinically proven"],
  beauty: ["miracle", "permanent results", "guaranteed results", "erase wrinkles", "clinically proven", "overnight results"],
  finance: ["guaranteed returns", "risk-free", "get rich", "no risk", "double your money", "guaranteed approval"],
};
