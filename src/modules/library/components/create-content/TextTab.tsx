"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useGenerateMedia } from "../../hooks/useMedia";

export function TextTab({ onSuccess }: { onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const generate = useGenerateMedia();

  async function handleCreate() {
    await generate.mutateAsync({
      type: "text",
      content,
    });
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <Textarea
        id="content"
        label="Post content"
        required
        hint={`${content.length} characters`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your text post content here..."
        className="min-h-[160px]"
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleCreate}
          loading={generate.isPending}
          disabled={!content.trim()}
        >
          Save to Media
        </Button>
      </div>

      {generate.error && (
        <p className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{generate.error.message}</p>
      )}
    </div>
  );
}
