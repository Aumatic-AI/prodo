import { createStore } from "zustand/vanilla";
import type { FieldErrors, OnboardingDraft } from "@/core/onboarding/schemas";

export type Slice = "content" | "basics" | "products" | "services";

/** Keys of a slice that hold lists, e.g. "products" in the products slice. */
type ListKey<S extends Slice> = {
  [K in keyof OnboardingDraft[S]]: OnboardingDraft[S][K] extends unknown[] ? K : never;
}[keyof OnboardingDraft[S]];

type ItemOf<S extends Slice, K extends ListKey<S>> = OnboardingDraft[S][K] extends (infer I)[] ? I : never;

export interface OnboardingState {
  draft: OnboardingDraft;
  /** Field errors for the step on screen, keyed by path inside its slice */
  errors: FieldErrors;
  /** The last saved copy of every slice */
  saved: OnboardingDraft;
  /** Slices whose answers differ from the saved copy */
  dirty: Partial<Record<Slice, boolean>>;
  saving: boolean;
  saveError: string | null;

  update: <S extends Slice>(slice: S, patch: Partial<OnboardingDraft[S]>) => void;
  addItem: <S extends Slice, K extends ListKey<S>>(slice: S, key: K, item: ItemOf<S, K>) => void;
  updateItem: <S extends Slice, K extends ListKey<S>>(slice: S, key: K, index: number, patch: Partial<ItemOf<S, K>>) => void;
  removeItem: <S extends Slice, K extends ListKey<S>>(slice: S, key: K, index: number) => void;

  setErrors: (errors: FieldErrors) => void;
  setSaving: (saving: boolean, saveError?: string | null) => void;
  /** Takes the server's copy of a slice after a save */
  applySaved: (slice: Slice | null, fresh: OnboardingDraft) => void;
  setStatus: (status: OnboardingDraft["status"]) => void;
  /**
   * Takes a fresh copy from the server (e.g. after the website scan filled Basics and the products).
   * Fields the client has edited and not saved keep their edits; every other field takes the fresh copy.
   */
  refresh: (fresh: OnboardingDraft) => void;
}

/** Deep equality that ignores key order (values that only look changed don't count as edits). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") return a === b || (a == null && b == null);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((v, i) => same(v, (b as unknown[])[i]));
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** New draft for one slice, with that slice marked dirty only when it really differs from what's saved. */
function withSlice<S extends Slice>(s: OnboardingState, slice: S, value: OnboardingDraft[S]) {
  return {
    draft: { ...s.draft, [slice]: value },
    dirty: { ...s.dirty, [slice]: !same(value, s.saved[slice]) },
  };
}

function withoutPaths(errors: FieldErrors, prefixes: string[]): FieldErrors {
  if (!prefixes.length) return errors;
  return Object.fromEntries(
    Object.entries(errors).filter(([path]) => !prefixes.some((p) => path === p || path.startsWith(`${p}.`)))
  );
}

export function createOnboardingStore(initial: OnboardingDraft) {
  return createStore<OnboardingState>()((set) => ({
    draft: initial,
    saved: initial,
    errors: {},
    dirty: {},
    saving: false,
    saveError: null,

    update: (slice, patch) =>
      set((s) => ({
        ...withSlice(s, slice, { ...s.draft[slice], ...patch }),
        errors: withoutPaths(s.errors, Object.keys(patch)),
      })),

    addItem: (slice, key, item) =>
      set((s) => {
        const list = s.draft[slice][key] as unknown[];
        return {
          ...withSlice(s, slice, { ...s.draft[slice], [key]: [...list, item] }),
          errors: withoutPaths(s.errors, [String(key)]),
        };
      }),

    updateItem: (slice, key, index, patch) =>
      set((s) => {
        const list = (s.draft[slice][key] as Record<string, unknown>[]).map((item, i) => (i === index ? { ...item, ...patch } : item));
        return {
          ...withSlice(s, slice, { ...s.draft[slice], [key]: list }),
          errors: withoutPaths(s.errors, Object.keys(patch).map((f) => `${String(key)}.${index}.${f}`)),
        };
      }),

    removeItem: (slice, key, index) =>
      set((s) => {
        const list = (s.draft[slice][key] as unknown[]).filter((_, i) => i !== index);
        // Item paths shift after a removal, so drop that list's errors
        return {
          ...withSlice(s, slice, { ...s.draft[slice], [key]: list }),
          errors: withoutPaths(s.errors, [String(key)]),
        };
      }),

    setErrors: (errors) => set({ errors }),
    setSaving: (saving, saveError = null) => set({ saving, saveError }),

    applySaved: (slice, fresh) =>
      set((s) => ({
        draft: {
          ...s.draft,
          step: fresh.step,
          status: fresh.status,
          ...(slice ? { [slice]: fresh[slice] } : {}),
        },
        saved: slice ? { ...s.saved, [slice]: fresh[slice] } : s.saved,
        dirty: slice ? { ...s.dirty, [slice]: false } : s.dirty,
        errors: {},
      })),

    setStatus: (status) => set((s) => ({ draft: { ...s.draft, status } })),

    refresh: (fresh) =>
      set((s) => {
        const slices: Slice[] = ["content", "basics", "products", "services"];
        // Field by field: what the client changed and hasn't saved stays theirs, every other field takes the fresh
        // copy. A whole step can't be kept back for one change: opening Basics sets the browser's time zone, and
        // that alone used to keep everything the scan found out of the form
        const merged = Object.fromEntries(
          slices.map((k) => {
            if (!s.dirty[k]) return [k, fresh[k]];
            const draft = s.draft[k] as unknown as Record<string, unknown>;
            const saved = s.saved[k] as unknown as Record<string, unknown>;
            const next = fresh[k] as unknown as Record<string, unknown>;
            const fields = new Set([...Object.keys(next), ...Object.keys(draft)]);
            return [k, Object.fromEntries([...fields].map((f) => [f, same(draft[f], saved[f]) ? next[f] : draft[f]]))];
          })
        ) as Pick<OnboardingDraft, Slice>;
        const server = Object.fromEntries(slices.map((k) => [k, fresh[k]])) as Pick<OnboardingDraft, Slice>;
        return {
          draft: { ...s.draft, ...merged, step: fresh.step, status: fresh.status, scan: fresh.scan },
          saved: { ...s.saved, ...server, step: fresh.step, status: fresh.status, scan: fresh.scan },
          dirty: Object.fromEntries(slices.map((k) => [k, !same(merged[k], server[k])])) as Partial<Record<Slice, boolean>>,
        };
      }),
  }));
}

export type OnboardingStoreApi = ReturnType<typeof createOnboardingStore>;
