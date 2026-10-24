import type {
  CaseStudyDraft,
  CredentialDraft,
  DateDraft,
  OfferDraft,
  ProductDraft,
  ReviewDraft,
  ServiceDraft,
} from "@/core/onboarding/schemas";

// New list items. Ids are made here so offers and reviews can point at unsaved products.
const id = () => crypto.randomUUID();

export const newProduct = (currency: string, patch: Partial<ProductDraft> = {}): ProductDraft => ({
  id: id(),
  name: "",
  price: null,
  currency,
  url: "",
  isHero: false,
  photos: [],
  benefits: [],
  audience: "",
  objections: [],
  ...patch,
});

export const newOffer = (): OfferDraft => ({ id: id(), title: "", details: "", offeringId: null, endsAt: "" });
export const newReview = (): ReviewDraft => ({ id: id(), content: "", author: "", offeringId: null, sourceUrl: "" });
export const newDate = (): DateDraft => ({ id: id(), name: "", date: "", kind: "sale" });

export const newService = (currency: string): ServiceDraft => ({
  id: id(),
  name: "",
  priceModel: "fixed",
  price: null,
  currency,
  included: "",
  url: "",
  turnaround: "",
  steps: [],
});

export const newCaseStudy = (): CaseStudyDraft => ({ id: id(), client: "", result: "", photos: [] });
export const newCredential = (): CredentialDraft => ({ id: id(), kind: "certification", content: "" });
export const newCompetitor = () => ({ id: id(), name: "", link: "" });
