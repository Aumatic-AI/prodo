"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { Session } from "@/core/session";
import { createSessionStore, type SessionStore, type SessionStoreApi } from "./session-store";

const SessionContext = createContext<SessionStoreApi | null>(null);

/** One store per request, filled from the server, so nothing leaks between users. */
export function SessionStoreProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [store] = useState(() => createSessionStore(session));
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}

export function useSession<T>(selector: (state: SessionStore) => T): T {
  const store = useContext(SessionContext);
  if (!store) throw new Error("useSession must be used inside SessionStoreProvider");
  return useStore(store, selector);
}
