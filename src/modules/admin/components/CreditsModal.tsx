"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Modal } from "@/components/kit/Modal";
import { Alert } from "@/components/kit/Alert";
import { CreditAmount } from "@/components/kit/Credits";
import { button } from "@/components/kit/styles";
import { DEFAULT_START_CREDITS } from "@/config/credits";
import { Segmented } from "@/modules/insights/components/shared/Segmented";
import { useAddCredits } from "../hooks/useAdmin";
import { CreditFields, type CreditValues } from "./CreditFields";
import { businessName } from "./parts";
import type { AdminBusiness } from "@/core/admin/businesses";

// Top up a business (credits, and what they paid when given) or take credits away (a mistake, a refund).

export function CreditsModal({ business, onClose }: { business: AdminBusiness | null; onClose: () => void }) {
  const add = useAddCredits(business?.id ?? "");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [values, setValues] = useState<CreditValues>({ credits: DEFAULT_START_CREDITS, amountUsd: null, note: "" });
  const [error, setError] = useState<string | undefined>();

  function close() {
    onClose();
    setTimeout(() => {
      setMode("add");
      setValues({ credits: DEFAULT_START_CREDITS, amountUsd: null, note: "" });
      setError(undefined);
      add.reset();
    }, 200);
  }

  const amount = values.credits ?? 0;
  const after = business ? business.credits + (mode === "add" ? amount : -amount) : 0;

  async function submit() {
    if (!business) return;
    if (!values.credits || values.credits < 1) return setError("Enter 1 or more credits");
    if (mode === "remove" && values.credits > business.credits) return setError(`This business has only ${business.credits} credits`);
    setError(undefined);
    await add.mutateAsync({ credits: mode === "add" ? values.credits : -values.credits, amountUsd: mode === "add" ? values.amountUsd : null, note: values.note.trim() || null });
    close();
  }

  return (
    <Modal
      open={!!business}
      onOpenChange={(o) => !o && close()}
      title={mode === "add" ? "Add credits" : "Remove credits"}
      description={business ? businessName(business) : undefined}
      className="w-[min(calc(100vw-32px),600px)]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-ob-muted">
            Balance after <CreditAmount value={Math.max(0, after)} size={13} className="font-bold text-ob-ink" />
          </span>
          <div className="flex gap-2">
            <button type="button" className={button({ variant: "secondary" })} onClick={close}>
              Cancel
            </button>
            <button type="button" className={button({ variant: mode === "add" ? "primary" : "dangerSolid" })} disabled={add.isPending} onClick={submit}>
              {mode === "add" ? <Plus size={16} /> : <Minus size={16} />}
              {add.isPending ? "Saving…" : mode === "add" ? "Add credits" : "Remove credits"}
            </button>
          </div>
        </div>
      }
    >
      {business && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[14px] text-ob-muted">
              Now <CreditAmount value={business.credits} unit className="font-bold text-ob-ink" />
            </span>
            <Segmented
              label="Add or remove"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(undefined);
                setValues(m === "add" ? { credits: DEFAULT_START_CREDITS, amountUsd: null, note: "" } : { credits: null, amountUsd: null, note: "" });
              }}
              options={[
                { value: "add", label: "Add" },
                { value: "remove", label: "Remove" },
              ]}
            />
          </div>
          <CreditFields value={values} onChange={setValues} error={error} removing={mode === "remove"} />
          {business.feesDue && mode === "add" && (
            <Alert tone="warn">
              A monthly fee of {business.feesDue.credits} credits is waiting. It&rsquo;s taken from these credits as soon as they&rsquo;re added, and publishing starts again.
            </Alert>
          )}
          {add.error && <Alert tone="error">{add.error.message}</Alert>}
        </div>
      )}
    </Modal>
  );
}
