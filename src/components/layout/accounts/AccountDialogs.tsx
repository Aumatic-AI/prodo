"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/kit/Modal";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Pills } from "@/components/kit/choices";
import { Alert } from "@/components/kit/Alert";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { button } from "@/components/kit/styles";
import type { AccountView } from "@/core/accounts";
import { startNewBusiness } from "./useAccounts";

type Way = "existing" | "new";
const WAYS: { value: Way; label: string }[] = [
  { value: "existing", label: "A business with its own login" },
  { value: "new", label: "A new business" },
];

/** "Add account": link a business that has its own login (sign in with it once), or set up a new one. */
export function AddAccountModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [way, setWay] = useState<Way>("existing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<{ added: string[]; notReady: string[] } | null>(null);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setPassword("");
      setProblem(null);
      setAdded(null);
    }
  }

  async function link(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await apiFetch<{ added: string[]; notReady: string[] }>("/api/account/link", { method: "POST", body: JSON.stringify({ email, password }) });
      setAdded(res);
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["account", "list"] });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't add it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startNew() {
    setBusy(true);
    setProblem(null);
    try {
      await startNewBusiness();
    } catch (err) {
      setBusy(false);
      setProblem(err instanceof Error ? err.message : "Couldn't start a new business. Try again.");
    }
  }

  return (
    <Modal open={open} onOpenChange={close} title="Add account" description="Your accounts stay on this login, on every device you log in with it." className="w-[min(calc(100vw-32px),520px)]">
      <div className="flex flex-col gap-5">
        <Pills options={WAYS} value={way} onChange={(w) => { setWay(w); setProblem(null); setAdded(null); }} label="What to add" />

        {way === "existing" ? (
          added ? (
            <div className="flex flex-col gap-3">
              <Alert tone="success">
                Added {added.added.join(", ")}. Open it from the account menu.
                {added.notReady.length > 0 && ` ${added.notReady.join(", ")} isn't set up yet, so it wasn't added.`}
              </Alert>
              <button type="button" className={button({ variant: "secondary" })} onClick={() => close(false)}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={link} className="flex flex-col gap-4">
              <p className="m-0 text-sm text-ob-muted">
                Sign in once with that business&apos;s own login. It&apos;s added when it&apos;s fully set up (research done and Brand Bible approved). It keeps its own login too.
              </p>
              <Field label="Email" htmlFor="add-email">
                <TextInput id="add-email" type="email" autoComplete="off" value={email} onValueChange={setEmail} placeholder="their login email" />
              </Field>
              <Field label="Password" htmlFor="add-password">
                <TextInput id="add-password" type="password" autoComplete="off" value={password} onValueChange={setPassword} />
              </Field>
              {problem && <Alert tone="error">{problem}</Alert>}
              <button type="submit" className={button()} disabled={busy || !email.trim() || !password}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Add business
              </button>
            </form>
          )
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-sm text-ob-muted">
              Opens its setup here: website, your content, basics, products or services, then research and the Brand Bible. It shows as &quot;Setting up&quot; in
              your accounts until you approve its Brand Bible; you can switch away and finish it later, from any device.
            </p>
            {problem && <Alert tone="error">{problem}</Alert>}
            <button type="button" className={button()} disabled={busy} onClick={startNew}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Start setup
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Takes a business off the login's list: unlinks a linked one, or deletes one still setting up. */
export function RemoveAccountDialog({ account, onClose }: { account: AccountView | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = account?.name || "This business";
  const deletes = account?.role === "owner";

  async function remove() {
    if (!account) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await apiFetch<{ reload: boolean }>("/api/account/remove", { method: "POST", body: JSON.stringify({ businessId: account.id }) });
      // The open business went away: reload into the login's own business
      if (res.reload || account.current) {
        window.location.assign("/week");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["account", "list"] });
      onClose();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't remove it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={!!account}
      onOpenChange={(o) => {
        if (!o) {
          setProblem(null);
          onClose();
        }
      }}
      title={deletes ? `Delete ${name}'s setup?` : `Remove ${name} from your accounts?`}
      description={
        deletes
          ? "Its setup isn't finished, so it's deleted with everything added so far (answers, photos, logo). This can't be undone."
          : "It keeps its own login and all its posts; it just stops showing on this login. You can add it again later."
      }
      confirmLabel={deletes ? "Delete setup" : "Remove"}
      danger
      busy={busy}
      error={problem}
      onConfirm={remove}
    />
  );
}
