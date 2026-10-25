"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { button } from "@/components/kit/styles";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Sticky area under the header, e.g. filters */
  toolbar?: ReactNode;
  /** Sticky area at the bottom, e.g. actions */
  footer?: ReactNode;
  className?: string;
  /** Replaces the body padding and scrolling, for layouts with their own scroll areas */
  bodyClassName?: string;
  children: ReactNode;
}

/** Centered dialog with a fixed header and footer and a scrolling body. */
export function Modal({ open, onOpenChange, title, description, toolbar, footer, className, bodyClassName, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ob-dark/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-40 flex max-h-[min(88vh,820px)] w-[min(calc(100vw-32px),960px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-ob-lg border border-ob-line bg-ob-bg font-ob text-ob-ink shadow-ob-md outline-none",
            "transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ob-line bg-ob-surface px-6 py-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="m-0 text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
              {description && <Dialog.Description className="m-0 text-sm text-ob-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className={button({ variant: "secondary", size: "icon" })} aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          {toolbar && <div className="border-b border-ob-line bg-ob-surface px-6 py-4">{toolbar}</div>}
          <div className={cn("min-h-0 flex-1", bodyClassName ?? "overflow-y-auto px-6 py-5")}>{children}</div>
          {footer && <div className="border-t border-ob-line bg-ob-surface px-6 py-4">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
