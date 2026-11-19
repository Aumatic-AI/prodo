// Which business a request is for, now that one login can have several (business_members, migration 0030).
// The database decides (current_business_id()), always checking the login belongs to the business asked for.

/** The business picked on this device: page loads open it. Set by switching; httpOnly. */
export const PICKED_BUSINESS_COOKIE = "prodo_business";

/** The business a browser tab shows. Every API call sends it, so a tab never acts on another business. */
export const TAB_BUSINESS_HEADER = "x-prodo-business";

/** The picked business, passed on from the cookie to the database for page loads. */
export const PICKED_BUSINESS_HEADER = "x-prodo-pick";

/** Tabs tell each other when the business changed, so none keeps showing the old one. */
export const BUSINESS_CHANNEL = "prodo-business";

/** The cookie lasts as long as a browser allows (400 days), renewed on every switch. */
export const PICKED_BUSINESS_MAX_AGE = 400 * 24 * 3600;

export const isBusinessId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
