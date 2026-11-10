export const LIMITS = {
  logoMaxBytes: 2 * 1024 * 1024,
  imageMaxBytes: 10 * 1024 * 1024,
  referenceImageMaxBytes: 5 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  descriptionMaxChars: 1500,
  /** Products or services a business can have; each one costs image and video work every week */
  offeringsMax: 15,
  /** Real photos per product */
  offeringPhotosMax: 3,
  /** Main products the website scan adds (the client can add more by hand) */
  scanOfferingsMax: 5,
  /** Photos the website scan saves per product */
  scanPhotosPerOffering: 2,
  captionMaxChars: 63206,
  fetchTimeoutMs: 60_000,
  /** A written answer from the language model: a full video brief takes over a minute */
  modelTimeoutMs: 4 * 60_000,
  downloadTimeoutMs: 5 * 60_000,
  /** Ad library pages are kept this long: ads change slowly, and Meta's video links last a few days */
  adLibraryCacheHours: 48,
  /** Live Ad library calls (1 ScrapeCreators credit each) a business can make in a day (UTC) */
  adLibraryCallsPerDay: 30,
} as const;
