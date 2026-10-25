import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { button } from "@/components/kit/styles";

interface FormFooterProps {
  note?: ReactNode;
  label: string;
  busy: boolean;
  disabled: boolean;
  error?: string | null;
  onSubmit: () => void;
}

/** Sticks to the bottom of the modal: a short note, the error if any, and the main action. */
export function FormFooter({ note, label, busy, disabled, error, onSubmit }: FormFooterProps) {
  return (
    <div className="sticky -bottom-5 z-10 -mx-6 -mb-5 mt-1 flex flex-col gap-3 border-t border-ob-line bg-ob-surface px-6 py-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-ob-muted">{note}</span>
        <button type="button" className={button()} disabled={disabled || busy} onClick={onSubmit}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {label}
        </button>
      </div>
    </div>
  );
}
