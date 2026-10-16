"use client";

import { Button } from "@/components/ui/Button";
import { AlertCircle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-12 h-12 text-danger mb-4" />
      <h1 className="text-xl font-semibold text-text mb-2">This page hit a problem</h1>
      <p className="text-sm text-muted mb-6 max-w-sm">{error.message || "Something went wrong. Try reloading the page."}</p>
      <Button onClick={reset}>Reload</Button>
    </div>
  );
}
