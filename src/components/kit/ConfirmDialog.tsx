"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { button } from "./styles";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, danger, busy, error, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="w-[min(calc(100vw-32px),480px)]"
      footer={
        <div className="flex justify-end gap-2.5">
          <button type="button" className={button({ variant: "secondary" })} onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={button({ variant: danger ? "dangerSolid" : "primary" })} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-[15px] text-ob-ink-soft">
        {description}
        {error && <p className="m-0 text-sm font-medium text-ob-danger">{error}</p>}
      </div>
    </Modal>
  );
}
