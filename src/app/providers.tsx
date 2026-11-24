"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      // Anything the client does can use or return credits (a post, a plan, a refresh): the balance is read again
      mutationCache: new MutationCache({ onSettled: () => client.invalidateQueries({ queryKey: ["credits"] }) }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
        },
      },
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
