"use client";

import { X } from "lucide-react";
import { AddButton } from "../../components/blocks";
import { Field } from "../../components/form/Field";
import { NumberInput, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { CREDENTIAL_KIND_OPTIONS } from "../../config";
import { newCredential } from "../../lib/factories";
import { button } from "@/components/kit/styles";

export function CredentialsSection() {
  const { value, update, addItem, updateItem, removeItem } = useSlice("services");

  return (
    <>
      <Field label="Years in business" htmlFor="years" path="yearsInBusiness" optional>
        <NumberInput
          id="years"
          className="max-w-40"
          min={0}
          max={200}
          step="1"
          value={value.yearsInBusiness}
          onValueChange={(n) => update("services", { yearsInBusiness: n === null ? null : Math.round(n) })}
          placeholder="e.g. 8"
        />
      </Field>

      {value.credentials.length > 0 && <span className="text-sm font-semibold text-ob-ink">Certifications and awards</span>}
      {value.credentials.map((c, i) => {
        const set = (patch: Partial<typeof c>) => updateItem("services", "credentials", i, patch);
        return (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 sm:grid-cols-[170px_minmax(0,1fr)_auto]">
            <Field path={`credentials.${i}.kind`}>
              <Select aria-label="Type" options={CREDENTIAL_KIND_OPTIONS} value={c.kind} onValueChange={(kind) => set({ kind: kind as typeof c.kind })} />
            </Field>
            <Field path={`credentials.${i}.content`}>
              <TextInput aria-label={`Credential ${i + 1}`} value={c.content} onValueChange={(content) => set({ content })} placeholder="e.g. ISO 9001 certified" />
            </Field>
            <button type="button" className={button({ variant: "danger", size: "icon" })} aria-label="Remove credential" onClick={() => removeItem("services", "credentials", i)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
      <AddButton onClick={() => addItem("services", "credentials", newCredential())}>Add certification or award</AddButton>
    </>
  );
}
