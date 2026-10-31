import { z } from "zod";

// Every editable list in the Brand Hub, defined once. The API builds its checks from these
// fields and the screens build their forms and lists from them. Brand rows with an `active`
// column are archived, never deleted.

export type FieldType = "text" | "textarea" | "url" | "number" | "percent" | "select" | "lines" | "switch" | "date" | "offering";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Shown in the list under the title */
  inList?: boolean;
}

export interface ResourceDef {
  table: string;
  /** Singular, for buttons ("Add offering") */
  noun: string;
  fields: FieldDef[];
  /** Column that names a row in lists */
  titleKey: string;
  /** Has `active`: removing archives it. Otherwise removing deletes the row. */
  archive: boolean;
  /** Has `verified`: rows found by agents wait for confirmation */
  verify: boolean;
  order: { column: string; ascending: boolean }[];
  /** Rows of one table split by a column (e.g. brand_assets by kind) */
  scope?: { column: string; values: string[] };
}

const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

export const RESOURCES = {
  offerings: {
    table: "offerings",
    noun: "offering",
    titleKey: "name",
    archive: true,
    verify: true,
    order: [
      { column: "is_hero", ascending: false },
      { column: "priority", ascending: false },
      { column: "created_at", ascending: true },
    ],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "kind", label: "Type", type: "select", required: true, options: opts([["product", "Product"], ["service", "Service"]]), inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "price", label: "Price", type: "number", inList: true },
      { key: "currency", label: "Currency (e.g. USD)", type: "text" },
      {
        key: "price_model",
        label: "Pricing",
        type: "select",
        options: opts([["fixed", "Fixed price"], ["from", "Starting from"], ["hourly", "Per hour"], ["subscription", "Monthly / package"], ["quote", "Quote on request"]]),
      },
      { key: "url", label: "Page link", type: "url" },
      { key: "benefits", label: "Benefits", type: "lines" },
      { key: "objections", label: "Objections customers raise", type: "lines" },
      { key: "audience", label: "Who it's for", type: "textarea" },
      { key: "is_hero", label: "Hero (promote most)", type: "switch", inList: true },
    ],
  },
  offers: {
    table: "offers",
    noun: "offer",
    titleKey: "title",
    archive: true,
    verify: true,
    order: [{ column: "created_at", ascending: false }],
    fields: [
      { key: "title", label: "Offer", type: "text", required: true, placeholder: "e.g. 20% off all mugs" },
      { key: "details", label: "Details", type: "textarea" },
      { key: "code", label: "Discount code", type: "text", inList: true },
      { key: "offering_id", label: "For which offering", type: "offering", placeholder: "Everything" },
      { key: "starts_at", label: "Starts", type: "date" },
      { key: "ends_at", label: "Ends", type: "date", inList: true },
    ],
  },
  proof: {
    table: "proof_items",
    noun: "proof point",
    titleKey: "content",
    archive: false,
    verify: true,
    order: [{ column: "created_at", ascending: false }],
    fields: [
      {
        key: "kind",
        label: "Type",
        type: "select",
        required: true,
        inList: true,
        options: opts([["review", "Review"], ["testimonial", "Testimonial"], ["case_study", "Case study"], ["stat", "Number or result"], ["award", "Award"], ["certification", "Certification"]]),
      },
      { key: "content", label: "What it says", type: "textarea", required: true },
      { key: "author", label: "Who said it / client", type: "text", inList: true },
      { key: "rating", label: "Rating (0–5)", type: "number" },
      { key: "offering_id", label: "About which offering", type: "offering", placeholder: "The whole business" },
    ],
  },
  personas: {
    table: "personas",
    noun: "persona",
    titleKey: "name",
    archive: true,
    verify: false,
    order: [{ column: "created_at", ascending: true }],
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Busy first-time parent" },
      { key: "summary", label: "Summary", type: "textarea", inList: true },
      { key: "pains", label: "Pains", type: "lines" },
      { key: "desires", label: "Wants", type: "lines" },
      { key: "objections", label: "Objections", type: "lines" },
      { key: "triggers", label: "Buying triggers", type: "lines" },
      { key: "phrases", label: "Things they say", type: "lines" },
    ],
  },
  pillars: {
    table: "content_pillars",
    noun: "pillar",
    titleKey: "name",
    archive: true,
    verify: false,
    order: [{ column: "target_share", ascending: false }],
    fields: [
      { key: "name", label: "Pillar", type: "text", required: true },
      { key: "description", label: "What posts in it are about", type: "textarea", inList: true },
      { key: "target_share", label: "Share of posts", type: "percent", inList: true },
      { key: "funnel_stage", label: "Goal", type: "select", inList: true, options: opts([["tofu", "Reach new people"], ["mofu", "Build trust"], ["bofu", "Drive sales"]]) },
    ],
  },
  competitors: {
    table: "competitors",
    noun: "competitor",
    titleKey: "name",
    archive: false,
    verify: false,
    order: [{ column: "created_at", ascending: true }],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "website", label: "Website", type: "url", inList: true },
    ],
  },
  assets: {
    table: "brand_assets",
    noun: "photo or video",
    titleKey: "storage_key",
    archive: false,
    verify: false,
    order: [{ column: "created_at", ascending: false }],
    scope: { column: "kind", values: ["product_photo", "person", "team", "location", "work", "general", "reference_image", "reference_video"] },
    fields: [
      {
        key: "kind",
        label: "What it shows",
        type: "select",
        required: true,
        inList: true,
        options: opts([
          ["product_photo", "Product"],
          ["person", "Person in our posts"],
          ["team", "Team"],
          ["location", "Place"],
          ["work", "Our work"],
          ["general", "Ours, other"],
          ["reference_image", "Image we like (another brand's)"],
          ["reference_video", "Video we like (another brand's)"],
        ]),
      },
      { key: "offering_id", label: "Offering", type: "offering", placeholder: "None" },
      { key: "tags", label: "Tags", type: "lines" },
    ],
  },
} satisfies Record<string, ResourceDef>;

export type ResourceKey = keyof typeof RESOURCES;
export const RESOURCE_KEYS = Object.keys(RESOURCES) as ResourceKey[];

export function isResourceKey(value: string): value is ResourceKey {
  return value in RESOURCES;
}

/** One brand row as the API returns it. */
export type ResourceRow = Record<string, unknown> & { id: string; active?: boolean; verified?: boolean };

function fieldSchema(field: FieldDef): z.ZodTypeAny {
  const text = z.string().trim().max(field.type === "textarea" ? 4000 : 500);
  switch (field.type) {
    case "text":
    case "textarea":
      return field.required ? text.min(1, `Add the ${field.label.toLowerCase()}`) : text.transform((v) => v || null).nullable();
    case "url":
      return z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Enter a full link starting with https://")
        .transform((v) => v || null)
        .nullable();
    case "number":
      return z.number().min(0).max(1_000_000_000).nullable();
    case "percent":
      return z.number().min(0).max(1);
    case "select":
      return field.required ? z.enum(field.options!.map((o) => o.value) as [string, ...string[]]) : z.enum(field.options!.map((o) => o.value) as [string, ...string[]]).nullable();
    case "lines":
      return z.array(z.string().trim().min(1).max(300)).max(30);
    case "switch":
      return z.boolean();
    case "date":
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
        .nullable();
    case "offering":
      return z.string().uuid().nullable();
  }
}

/** Zod schema for creating (all required fields) or updating (any subset) a row. */
export function resourceSchema(key: ResourceKey, mode: "create" | "update") {
  const def: ResourceDef = RESOURCES[key];
  const shape = Object.fromEntries(def.fields.map((f) => [f.key, mode === "update" || !f.required ? fieldSchema(f).optional() : fieldSchema(f)]));
  const extra = {
    ...(def.archive ? { active: z.boolean().optional() } : {}),
    ...(key === "assets" && mode === "create" ? { storage_key: z.string().min(1).max(300) } : {}),
  };
  return z.object({ ...shape, ...extra }).strict();
}
