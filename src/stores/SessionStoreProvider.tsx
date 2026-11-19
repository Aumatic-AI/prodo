"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { Session } from "@/core/session";
import { setTabBusiness } from "@/lib/api-client";
import { BUSINESS_CHANNEL } from "@/lib/active-business";
import { createSessionStore, type SessionStore, type SessionStoreApi } from "./session-store";

const SessionContext = createContext<SessionStoreApi | null>(null);

/** One store per request, filled from the server, so nothing leaks between users. */
export function SessionStoreProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [store] = useState(() => {
    // In the browser only: every API call from this tab names this business (a server-side module value would be shared)
    if (typeof window !== "undefined") setTabBusiness(session.business.id);
    return createSessionStore(session);
  });

  // Another tab switched business: this one reloads, so no tab keeps showing the old one
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BUSINESS_CHANNEL);
    channel.onmessage = (e: MessageEvent<{ businessId?: string }>) => {
      if (e.data?.businessId && e.data.businessId !== session.business.id) window.location.reload();
    };
    return () => channel.close();
  }, [session.business.id]);

  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}

export function useSession<T>(selector: (state: SessionStore) => T): T {
  const store = useContext(SessionContext);
  if (!store) throw new Error("useSession must be used inside SessionStoreProvider");
  return useStore(store, selector);
}
