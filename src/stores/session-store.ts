import { createStore } from "zustand/vanilla";
import type { Session, SessionBusiness } from "@/core/session";

export interface SessionStore extends Session {
  updateBusiness: (patch: Partial<SessionBusiness>) => void;
}

export function createSessionStore(initial: Session) {
  return createStore<SessionStore>()((set) => ({
    ...initial,
    updateBusiness: (patch) => set((s) => ({ business: { ...s.business, ...patch } })),
  }));
}

export type SessionStoreApi = ReturnType<typeof createSessionStore>;
