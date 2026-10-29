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
  downloadTimeoutMs: 5 * 60_000,
} as const;
