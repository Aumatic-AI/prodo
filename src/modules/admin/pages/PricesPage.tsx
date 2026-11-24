"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { NumberInput } from "@/components/kit/inputs";
import { PageHeader } from "@/components/kit/PageHeader";
import { SaveBar } from "@/components/kit/SaveBar";
import { Skeleton } from "@/components/kit/Skeleton";
import { CREDIT_PACKS, CREDIT_USD } from "@/config/credits";
import { useAdminPrices, useSavePrices } from "../hooks/useAdmin";
import { money } from "../components/parts";

/** Credits per action. A change applies to what's started from then on; past charges stay as they were. */
export function PricesPage() {
  const { data, isLoading, error } = useAdminPrices();
  const save = useSavePrices();
  const [form, setForm] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (data) setForm(Object.fromEntries(data.map((p) => [p.action, p.credits])));
  }, [data]);

  const dirty = !!data && data.some((p) => form[p.action] !== p.credits);
  const invalid = Object.values(form).some((v) => v === null || v < 0 || !Number.isInteger(v));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Prices" description="What each action costs in credits. Changes apply to work started after saving; past charges don't change." />

      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Credits per action" description={`At $${CREDIT_USD.toFixed(2)} a credit before pack savings.`} bodyClassName="p-0 pt-2">
            <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
              {data.map((p) => (
                <li key={p.action} className="flex items-center justify-between gap-4 px-6 py-3">
                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-ob-ink">{p.label}</span>
                  <span className="hidden w-20 text-right text-[12.5px] tabular-nums text-ob-muted sm:block">{form[p.action] != null ? money((form[p.action] ?? 0) * CREDIT_USD) : "—"}</span>
                  <div className="w-28">
                    <NumberInput
                      aria-label={`${p.label} credits`}
                      min={0}
                      step={1}
                      value={form[p.action] ?? null}
                      onValueChange={(v) => setForm((f) => ({ ...f, [p.action]: v === null ? null : Math.round(v) }))}
                      className="min-h-10 text-right"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Packs" description="What clients buy. Shortcuts in Add business and Add credits.">
            <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
              {CREDIT_PACKS.map((pack) => (
                <li key={pack.name} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="font-semibold">{pack.name}</span>
                  <span className="tabular-nums text-ob-muted">
                    ${pack.usd} · {pack.credits.toLocaleString("en")} credits · ${(pack.usd / pack.credits).toFixed(3)} each
                  </span>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-3 text-[12.5px] text-ob-muted">Free: uploads, editing, scheduling, publishing, analytics, captions, Improve idea and the Ad library.</p>
          </Card>
        </div>
      )}

      <SaveBar
        show={dirty}
        saving={save.isPending}
        error={invalid ? "Every price needs a whole number of credits, 0 or more." : save.error?.message}
        onSave={() => !invalid && save.mutate(Object.entries(form).map(([action, credits]) => ({ action, credits: credits ?? 0 })))}
        onDiscard={() => data && setForm(Object.fromEntries(data.map((p) => [p.action, p.credits])))}
      />
    </div>
  );
}
