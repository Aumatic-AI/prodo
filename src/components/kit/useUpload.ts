"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { uploadProblem, type UploadPurpose } from "@/config/uploads";
import type { Upload } from "@/core/onboarding/schemas";

/** Uploads a file straight to storage with a signed link. Returns its storage key. */
export function useUpload(purpose: UploadPurpose) {
  return useCallback(
    async (file: File): Promise<Upload> => {
      const problem = uploadProblem(purpose, file.type, file.size);
      if (problem) throw new Error(problem);

      const { id, key, url } = await apiFetch<{ id: string; key: string; url: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ purpose, contentType: file.type, size: file.size }),
      });

      const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }).catch(() => null);
      if (!res?.ok) throw new Error("The upload didn't finish. Please try again.");

      return { id, key };
    },
    [purpose]
  );
}
