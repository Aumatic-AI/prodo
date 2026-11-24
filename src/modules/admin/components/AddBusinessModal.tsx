"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, UserPlus } from "lucide-react";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Modal } from "@/components/kit/Modal";
import { Alert } from "@/components/kit/Alert";
import { button } from "@/components/kit/styles";
import { DEFAULT_START_CREDITS, formatCredits } from "@/config/credits";
import { useCreateBusiness } from "../hooks/useAdmin";
import { CreditFields, type CreditValues } from "./CreditFields";
import { newPassword } from "./parts";

// "Add business": the client's login (email and password, ready to use, no email sent) and their first credits.
// After it's made, the login details show once so the admin can copy them to the client.

const START: CreditValues = { credits: DEFAULT_START_CREDITS, amountUsd: null, note: "" };

export function AddBusinessModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateBusiness();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [credits, setCredits] = useState<CreditValues>(START);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [made, setMade] = useState<{ email: string; password: string; credits: number } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setPassword("");
    setShown(false);
    setCredits(START);
    setErrors({});
    setMade(null);
    setCopied(false);
    create.reset();
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  async function submit() {
    const found: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Enter a valid email address";
    if (password.length < 8) found.password = "Use at least 8 characters";
    if (credits.credits === null || credits.credits < 0) found.credits = "Enter the credits to give (0 or more)";
    setErrors(found);
    if (Object.keys(found).length) return;
    await create.mutateAsync({ email: email.trim().toLowerCase(), password, credits: credits.credits!, amountUsd: credits.amountUsd, note: credits.note.trim() || null });
    setMade({ email: email.trim().toLowerCase(), password, credits: credits.credits! });
  }

  async function copy() {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(`Prodo login\nEmail: ${made.email}\nPassword: ${made.password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={made ? "Business added" : "Add a business"}
      description={made ? "Send these login details to the client. They log in and set up their brand." : "Make the client's login and give their first credits. They set up the rest when they log in."}
      className="w-[min(calc(100vw-32px),600px)]"
      footer={
        made ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={button({ variant: "secondary" })} onClick={reset}>
              Add another
            </button>
            <button type="button" className={button()} onClick={() => close(false)}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className={button({ variant: "secondary" })} onClick={() => close(false)}>
              Cancel
            </button>
            <button type="button" className={button()} disabled={create.isPending} onClick={submit}>
              <UserPlus size={16} /> {create.isPending ? "Adding…" : "Add business"}
            </button>
          </div>
        )
      }
    >
      {made ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-ob-md border border-ob-line bg-ob-surface p-4 text-[14px]">
            <div className="flex justify-between gap-3">
              <span className="text-ob-muted">Email</span>
              <strong className="select-all break-all text-right">{made.email}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ob-muted">Password</span>
              <strong className="select-all break-all text-right font-mono">{made.password}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ob-muted">Credits</span>
              <strong className="tabular-nums">{formatCredits(made.credits)}</strong>
            </div>
          </div>
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy login details"}
          </button>
          <p className="m-0 text-[13px] text-ob-muted">The password isn&rsquo;t shown again. You can set a new one from the business&rsquo;s page.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="new-email" error={errors.email}>
              <TextInput id="new-email" type="email" autoComplete="off" value={email} placeholder="owner@business.com" onValueChange={setEmail} />
            </Field>
            <Field
              label="Password"
              htmlFor="new-password"
              error={errors.password}
              hint={
                <button type="button" className="inline-flex items-center gap-1 font-semibold text-ob-primary hover:underline" onClick={() => (setPassword(newPassword()), setShown(true))}>
                  <KeyRound size={13} /> Make one for me
                </button>
              }
            >
              <div className="relative">
                <TextInput id="new-password" type={shown ? "text" : "password"} autoComplete="new-password" value={password} className="pr-11" onValueChange={setPassword} />
                <button
                  type="button"
                  aria-label={shown ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-ob text-ob-muted hover:bg-ob-sunken"
                  onClick={() => setShown((s) => !s)}
                >
                  {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>
          <CreditFields value={credits} onChange={setCredits} error={errors.credits} />
          {create.error && <Alert tone="error">{create.error.message}</Alert>}
        </div>
      )}
    </Modal>
  );
}
