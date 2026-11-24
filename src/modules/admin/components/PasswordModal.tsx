"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Modal } from "@/components/kit/Modal";
import { Alert } from "@/components/kit/Alert";
import { button } from "@/components/kit/styles";
import { useSetPassword } from "../hooks/useAdmin";
import { newPassword } from "./parts";

// A new password for a business's own login (no email is sent: the admin passes it on).

export function PasswordModal({ businessId, email, open, onOpenChange }: { businessId: string; email: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const save = useSetPassword(businessId);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setPassword("");
      setError(undefined);
      setDone(false);
      setCopied(false);
      save.reset();
    }, 200);
  }

  async function submit() {
    if (password.length < 8) return setError("Use at least 8 characters");
    setError(undefined);
    await save.mutateAsync(password);
    setDone(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Prodo login\nEmail: ${email ?? ""}\nPassword: ${password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title={done ? "Password changed" : "Change password"}
      description={email ?? undefined}
      className="w-[min(calc(100vw-32px),520px)]"
      footer={
        <div className="flex justify-end gap-2">
          {done ? (
            <button type="button" className={button()} onClick={close}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className={button({ variant: "secondary" })} onClick={close}>
                Cancel
              </button>
              <button type="button" className={button()} disabled={save.isPending} onClick={submit}>
                <KeyRound size={16} /> {save.isPending ? "Saving…" : "Set password"}
              </button>
            </>
          )}
        </div>
      }
    >
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-ob-muted">The old password stops working now. Send the new one to the client:</p>
          <strong className="select-all break-all rounded-ob-md border border-ob-line bg-ob-surface px-4 py-3 font-mono text-[15px]">{password}</strong>
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy login details"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label="New password"
            htmlFor="reset-password"
            error={error}
            hint={
              <button type="button" className="inline-flex items-center gap-1 font-semibold text-ob-primary hover:underline" onClick={() => setPassword(newPassword())}>
                <KeyRound size={13} /> Make one for me
              </button>
            }
          >
            <TextInput id="reset-password" type="text" autoComplete="new-password" value={password} onValueChange={setPassword} />
          </Field>
          {save.error && <Alert tone="error">{save.error.message}</Alert>}
        </div>
      )}
    </Modal>
  );
}
