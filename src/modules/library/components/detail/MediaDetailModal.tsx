"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw, Send, Trash2, Wand2 } from "lucide-react";
import { Modal } from "@/components/kit/Modal";
import { TextArea } from "@/components/kit/inputs";
import { button } from "@/components/kit/styles";
import { publicUrl } from "@/components/kit/MediaUploader";
import { downloadFile } from "@/lib/download";
import { useDeleteMedia, useMediaItem, useRedoMedia } from "../../hooks/useMedia";
import { TYPE_META } from "../../lib/display";
import type { MediaListItem } from "../../types";
import { DetailFacts } from "./DetailFacts";
import { DetailPreview } from "./DetailPreview";

interface MediaDetailModalProps {
  media: MediaListItem | null;
  onClose: () => void;
  onCreatePost: (media: MediaListItem) => void;
  onRetry: (media: MediaListItem) => void;
}

/** Big preview on the left, idea, inputs and cost on the right. */
export function MediaDetailModal({ media, onClose, onCreatePost, onRetry }: MediaDetailModalProps) {
  const needsFiles = media?.type === "carousel";
  const { data: detail, isLoading } = useMediaItem(needsFiles ? media.id : null);
  const redo = useRedoMedia();
  const remove = useDeleteMedia();
  const [redoing, setRedoing] = useState(false);
  // Deleting asks inside this dialog (never a second dialog on top of it)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setRedoing(false);
    setConfirmingDelete(false);
    setNote("");
    redo.reset();
    remove.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.id]);

  if (!media) return null;
  const generated = media.source === "generated" && media.type !== "text";
  const canRedo = generated && !media.plan_item_id && media.status !== "generating";

  const footer = confirmingDelete ? (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-ob-ink-soft">
        <strong className="text-ob-ink">Delete this media?</strong> The file is removed for good. Media used by a post can&apos;t be deleted; delete the post first.
      </p>
      {remove.error && <p className="m-0 text-sm font-medium text-ob-danger">{remove.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={button({ variant: "secondary", size: "sm" })}
          disabled={remove.isPending}
          onClick={() => {
            setConfirmingDelete(false);
            remove.reset();
          }}
        >
          Cancel
        </button>
        <button type="button" className={button({ variant: "dangerSolid", size: "sm" })} disabled={remove.isPending} onClick={() => remove.mutate(media.id, { onSuccess: onClose })}>
          <Trash2 size={15} /> {remove.isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  ) : redoing ? (
    <div className="flex flex-col gap-2.5">
      <TextArea rows={2} autoFocus value={note} onValueChange={setNote} placeholder="What should change? e.g. Brighter colours, show the product closer" />
      {redo.error && <p className="m-0 text-sm text-ob-danger">{redo.error.message}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={button({ variant: "quiet", size: "sm" })} onClick={() => setRedoing(false)}>
          Back
        </button>
        <button
          type="button"
          className={button({ size: "sm" })}
          disabled={redo.isPending || note.trim().length < 2}
          onClick={() => redo.mutate({ id: media.id, note: note.trim() }, { onSuccess: onClose })}
        >
          <Wand2 size={15} /> {redo.isPending ? "Starting…" : "Make it again"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => setConfirmingDelete(true)}>
        <Trash2 size={15} /> Delete
      </button>
      <div className="flex flex-wrap gap-2">
        {media.storage_key && (
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => downloadFile(publicUrl(media.storage_key!), `prodo-${media.type}-${media.id.slice(0, 8)}`)}>
            <Download size={15} /> Download
          </button>
        )}
        {generated && (
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => onRetry(media)} title="Same inputs, new result">
            <RotateCcw size={15} /> Try again
          </button>
        )}
        {canRedo && (
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setRedoing(true)} title="A new version with your change; this one stays">
            <Wand2 size={15} /> Make again
          </button>
        )}
        {media.status === "ready" && (
          <button type="button" className={button({ size: "sm" })} onClick={() => onCreatePost(media)}>
            <Send size={15} /> Create post
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={TYPE_META[media.type].label} description={media.product_name ?? undefined} footer={footer} className="w-[min(calc(100vw-32px),1080px)]">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <DetailPreview media={media} detail={detail} loading={isLoading} />
        <DetailFacts media={media} />
      </div>
    </Modal>
  );
}
