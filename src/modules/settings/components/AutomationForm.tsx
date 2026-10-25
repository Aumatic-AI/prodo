"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { automationSchema, type Automation, type AutomationView } from "@/core/settings";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { Field } from "@/components/kit/Field";
import { NumberInput, TextInput } from "@/components/kit/inputs";
import { Select } from "@/components/kit/Select";
import { TimePicker } from "@/components/kit/TimePicker";
import { ChoiceCards } from "@/components/kit/choices";
import { Switch } from "@/components/kit/controls";
import { SaveBar } from "@/components/kit/SaveBar";
import { Skeleton } from "@/components/kit/Skeleton";
import { row } from "@/components/kit/styles";
import { AUTOPILOT_OPTIONS, WEEKDAY_OPTIONS } from "@/modules/onboarding/config";

const KEY = ["settings", "automation"];

const fromView = (v: AutomationView): Automation => ({
  autopilot_mode: v.autopilot_mode,
  paused: v.paused,
  plan_weekday: v.plan_weekday,
  plan_time: v.plan_time,
  approval_timeout_hours: v.approval_timeout_hours,
  monthly_budget_usd: v.monthly_budget_usd,
  notify_email: v.notify_email,
});

/** How much the agents do on their own, when they plan, and how much they may spend. */
export function AutomationForm() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<AutomationView>("/api/settings/automation") });
  const save = useMutation({
    mutationFn: (input: Automation) => apiFetch<AutomationView>("/api/settings/automation", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (view) => queryClient.setQueryData(KEY, view),
  });
  const [form, setForm] = useState<Automation | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm(fromView(data));
  }, [data]);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !data || !form) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const saved = fromView(data);
  const set = (patch: Partial<Automation>) => setForm({ ...form, ...patch });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const budget = Math.max(1, form.monthly_budget_usd || 1);
  const used = Math.min(100, Math.round((data.spentThisMonth / budget) * 100));

  function submit() {
    const parsed = automationSchema.safeParse(form);
    if (!parsed.success) return setProblem(parsed.error.issues[0].message);
    setProblem(null);
    save.mutate(parsed.data);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className={cn(form.paused && "border-ob-warn bg-ob-warn-soft")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", form.paused ? "bg-ob-warn text-ob-on-primary" : "bg-ob-sunken text-ob-muted")}>
              <PauseCircle size={20} />
            </span>
            <div className="flex flex-col gap-0.5">
              <strong className="text-base">{form.paused ? "All agents are paused" : "Agents are running"}</strong>
              <span className="text-sm text-ob-muted">Pausing stops planning, creating and posting until you turn it back on.</span>
            </div>
          </div>
          <Switch checked={form.paused} onChange={(paused) => set({ paused })} label="Pause all agents" />
        </div>
      </Card>

      <Card title="Autopilot" description="How much the agents do before asking you.">
        <ChoiceCards label="Autopilot" options={AUTOPILOT_OPTIONS} value={form.autopilot_mode} onChange={(autopilot_mode) => set({ autopilot_mode })} />
        {form.autopilot_mode === "full" && (
          <Field className="mt-5 max-w-[280px]" label="Auto-approve after (hours)" htmlFor="timeout" hint="Posts go out if you don't respond in time.">
            <NumberInput id="timeout" min={1} max={168} value={form.approval_timeout_hours} onValueChange={(v) => set({ approval_timeout_hours: v ?? 24 })} />
          </Field>
        )}
      </Card>

      <Card title="Weekly plan" description="When the Planner prepares next week's posts for you.">
        <div className={row}>
          <Field label="Day" htmlFor="plan-day">
            <Select id="plan-day" options={WEEKDAY_OPTIONS} value={String(form.plan_weekday)} onValueChange={(v) => set({ plan_weekday: Number(v) })} />
          </Field>
          <Field label="Time" htmlFor="plan-time">
            <TimePicker id="plan-time" value={form.plan_time} onChange={(plan_time) => set({ plan_time })} />
          </Field>
        </div>
      </Card>

      <Card title="Monthly AI budget" description="Agents stop for the month when their spend reaches it.">
        <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <Field label="Budget (USD)" htmlFor="budget">
            <NumberInput id="budget" min={1} value={form.monthly_budget_usd} onValueChange={(v) => set({ monthly_budget_usd: v ?? 0 })} />
          </Field>
          <div className="flex flex-col gap-2 pb-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">${data.spentThisMonth.toFixed(2)} spent this month</span>
              <span className="text-ob-muted">{used}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ob-line">
              <div
                className={cn("h-full rounded-full transition-[width]", used >= 90 ? "bg-ob-danger" : used >= 70 ? "bg-ob-warn" : "bg-ob-primary")}
                style={{ width: `${Math.max(2, used)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Notifications" description="Where we send plan-ready, approval and failure emails.">
        <Field label="Email" htmlFor="notify" optional className="max-w-[420px]">
          <TextInput id="notify" type="email" value={form.notify_email ?? ""} placeholder="you@business.com" onValueChange={(v) => set({ notify_email: v })} />
        </Field>
      </Card>

      <SaveBar
        show={dirty}
        saving={save.isPending}
        error={problem ?? save.error?.message}
        onSave={submit}
        onDiscard={() => {
          setForm(saved);
          setProblem(null);
        }}
      />
    </div>
  );
}
