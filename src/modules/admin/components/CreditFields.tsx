"use client";

import { AlertTriangle } from "lucide-react";
import { Field } from "@/components/kit/Field";
import { NumberInput, TextInput } from "@/components/kit/inputs";
import { CreditIcon } from "@/components/kit/Credits";
import { CREDIT_PACKS, CREDIT_USD, creditsForAmount, formatCredits } from "@/config/credits";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";

// Credits (required) and what the client paid (optional), with the packs as shortcuts. When an amount is given
// and the credits don't match what it buys, a warning says so, but nothing is blocked: the admin decides.

export interface CreditValues {
  credits: number | null;
  amountUsd: number | null;
  note: string;
}

export function CreditFields({ value, onChange, error, removing = false }: { value: CreditValues; onChange: (v: CreditValues) => void; error?: string; removing?: boolean }) {
  const set = (patch: Partial<CreditValues>) => onChange({ ...value, ...patch });
  const expected = !removing && value.amountUsd ? creditsForAmount(value.amountUsd) : null;
  const mismatch = expected && value.credits !== null && value.credits !== expected.credits ? value.credits - expected.credits : 0;

  return (
    <div className="flex flex-col gap-4">
      {!removing && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ob-ink">Packs</span>
          <div className="grid grid-cols-3 gap-2">
            {CREDIT_PACKS.map((p) => {
              const on = value.credits === p.credits && value.amountUsd === p.usd;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => set({ credits: p.credits, amountUsd: p.usd })}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-ob-md border px-3 py-2.5 text-left transition-colors",
                    focusRing,
                    on ? "border-ob-primary bg-ob-primary-soft" : "border-ob-line bg-ob-surface hover:border-ob-line-strong"
                  )}
                >
                  <span className="text-[12px] font-bold text-ob-muted">{p.name}</span>
                  <span className="flex items-center gap-1 text-[15px] font-extrabold tabular-nums text-ob-ink">
                    <CreditIcon size={14} className="text-ob-primary" />
                    {formatCredits(p.credits)}
                  </span>
                  <span className="text-[12px] tabular-nums text-ob-muted">${p.usd}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={removing ? "Credits to remove" : "Credits"}
          htmlFor="credits"
          error={error}
          hint={
            mismatch ? (
              <span className="flex items-start gap-1.5 font-medium text-ob-warn">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  ${value.amountUsd} buys {formatCredits(expected!.credits)} credits{expected!.pack ? ` (the ${expected!.pack} pack)` : ` at $${CREDIT_USD.toFixed(2)} each`}. This gives{" "}
                  {formatCredits(Math.abs(mismatch))} {mismatch > 0 ? "more" : "fewer"}.
                </span>
              </span>
            ) : removing ? (
              "Taken off the balance (never below 0)."
            ) : (
              `1 credit = $${CREDIT_USD.toFixed(2)}; packs give more.`
            )
          }
        >
          <NumberInput id="credits" min={removing ? 1 : 0} step={1} value={value.credits} onValueChange={(credits) => set({ credits: credits === null ? null : Math.round(credits) })} />
        </Field>
        {!removing && (
          <Field label="Amount paid" htmlFor="amount" optional hint="US dollars, for your records.">
            <NumberInput id="amount" prefix="$" min={0} step={0.01} value={value.amountUsd} placeholder="Not recorded" onValueChange={(amountUsd) => set({ amountUsd })} />
          </Field>
        )}
      </div>

      <Field label="Note" htmlFor="note" optional hint="Only admins see it, e.g. how they paid.">
        <TextInput id="note" value={value.note} maxLength={500} placeholder={removing ? "Why they're removed" : "e.g. Paid by bank transfer, invoice 104"} onValueChange={(note) => set({ note })} />
      </Field>
    </div>
  );
}
