"use client";

import { Field } from "../../components/form/Field";
import { ChoiceCards } from "@/components/kit/choices";
import { NumberInput } from "@/components/kit/inputs";
import { TimePicker } from "@/components/kit/TimePicker";
import { Select } from "@/components/kit/Select";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { AUTOPILOT_OPTIONS, WEEKDAY_OPTIONS } from "../../config";
import { row } from "@/components/kit/styles";

export function AutopilotSection() {
  const { value: v, update } = useSlice("style");
  const set = (patch: Partial<typeof v>) => update("style", patch);

  return (
    <>
      <Field path="autopilotMode">
        <ChoiceCards label="Autopilot" options={AUTOPILOT_OPTIONS} value={v.autopilotMode} onChange={(autopilotMode) => set({ autopilotMode })} />
      </Field>
      <div className={row}>
        <Field label="Plan my week on" htmlFor="plan-day" path="planWeekday">
          <Select id="plan-day" options={WEEKDAY_OPTIONS} value={String(v.planWeekday)} onValueChange={(d) => set({ planWeekday: Number(d) })} />
        </Field>
        <Field label="At" htmlFor="plan-time" path="planTime">
          <TimePicker id="plan-time" value={v.planTime} onChange={(planTime) => set({ planTime })} />
        </Field>
      </div>
      <Field label="Monthly budget for AI work" htmlFor="budget" path="monthlyBudgetUsd" hint="Agents pause and notify you when it's reached.">
        <NumberInput
          id="budget"
          className="max-w-40"
          prefix="$"
          min={1}
          step="1"
          value={v.monthlyBudgetUsd ?? null}
          onValueChange={(n) => set({ monthlyBudgetUsd: n as number })}
        />
      </Field>
    </>
  );
}
