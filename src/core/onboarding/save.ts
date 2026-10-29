import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { loadOnboarding } from "./load";
import { STEP_SCHEMAS, toFieldErrors, websiteSchema, type FieldErrors, type OnboardingDraft } from "./schemas";
import { saveBasics } from "./save-basics";
import { saveContent } from "./save-content";
import { saveProducts } from "./save-products";
import { saveServices } from "./save-services";
import { saveWebsite } from "./save-website";
import type { ScanState } from "./scan";
import { saveProgress } from "./sync";
import type { StepKey } from "./steps";

export class StepValidationError extends AppError {
  constructor(fields: FieldErrors) {
    super("Some answers need a fix before saving.", "INVALID_INPUT", false);
    this.fields = fields;
  }
}

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: any } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new StepValidationError(toFieldErrors(result.error));
  return result.data;
}

/** Which slice of the draft a step edits. */
export type StepSlice = "content" | "basics" | "products" | "services" | null;

async function businessSlice(db: SupabaseClient): Promise<"products" | "services"> {
  const { data } = await db.from("business_profile").select("business_type").single();
  if (!data?.business_type) throw new AppError("Finish the basics first.", "INVALID_INPUT", false);
  return data.business_type === "service" ? "services" : "products";
}

/**
 * Validates and saves one step, then returns the fresh draft for the client to merge.
 * `scan` is set when the website step started a new website read (the route sends its event).
 */
export async function saveStep(
  db: SupabaseClient,
  step: StepKey,
  body: unknown
): Promise<{ slice: StepSlice; draft: OnboardingDraft; scan?: ScanState }> {
  let slice: StepSlice = null;
  let scan: ScanState | null = null;

  switch (step) {
    case "website":
      scan = await saveWebsite(db, parse(websiteSchema, body).website);
      break;
    case "content":
      slice = "content";
      await saveContent(db, parse(STEP_SCHEMAS.content, body));
      break;
    case "basics":
      slice = "basics";
      await saveBasics(db, parse(STEP_SCHEMAS.basics, body));
      break;
    case "business":
      slice = await businessSlice(db);
      if (slice === "products") await saveProducts(db, parse(STEP_SCHEMAS.products, body));
      else await saveServices(db, parse(STEP_SCHEMAS.services, body));
      break;
    case "connect":
      await saveProgress(db, "review");
      break;
    case "review":
      break;
  }

  return { slice, draft: await loadOnboarding(db), ...(scan ? { scan } : {}) };
}
