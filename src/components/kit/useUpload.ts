"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/browser";
import { uploadProblem, type UploadPurpose } from "@/config/uploads";
import type { Upload } from "@/core/onboarding/schemas";

/** Uploads a file straight to storage with a signed link. Returns its storage key. */
export function useUpload(purpose: UploadPurpose) {
  return useCallback(
    async (file: File): Promise<Upload> => {
      const problem = uploadProblem(purpose, file.type, file.size);
      if (problem) throw new Error(problem);

      const { key, path, token } = await apiFetch<{ key: string; path: string; token: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ purpose, contentType: file.type, size: file.size }),
      });

      const { error } = await createClient().storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("The upload didn't finish. Please try again.");

      return { id: crypto.randomUUID(), key };
    },
    [purpose]
  );
}
