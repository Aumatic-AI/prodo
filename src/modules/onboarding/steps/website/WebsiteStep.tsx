"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { websiteSchema, toFieldErrors, type OnboardingDraft } from "@/core/onboarding/schemas";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Alert } from "@/components/kit/Alert";
import { button, card, container } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { useOnboarding, useOnboardingApi } from "../../store/OnboardingStoreProvider";
import { STEP_META } from "../../config";

/** Adds https:// when the client typed a bare domain like "myshop.com". */
function withScheme(value: string): string {
  const v = value.trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/** The first screen: the website. Saving it starts reading the site in the background. */
export function WebsiteStep() {
  const router = useRouter();
  const store = useOnboardingApi();
  const saved = useOnboarding((s) => s.draft.basics.website);
  const [website, setWebsite] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"site" | "none" | null>(null);

  async function save(value: string, which: "site" | "none") {
    const parsed = websiteSchema.safeParse({ website: value });
    if (!parsed.success) {
      setError(toFieldErrors(parsed.error).website ?? "Check the website address");
      return;
    }
    setError(null);
    setBusy(which);
    try {
      const res = await apiFetch<{ draft: OnboardingDraft }>("/api/onboarding/website", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      store.getState().refresh(res.draft);
      router.push("/onboarding/content");
    } catch (err) {
      setError(err instanceof ApiError && err.fields?.website ? err.fields.website : err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = withScheme(website);
    setWebsite(value);
    if (!value) {
      setError("Enter your website, or continue without one");
      return;
    }
    save(value, "site");
  }

  return (
    <div className={cn(container, "pb-24 pt-14")}>
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ob-primary">Set up Prodo</span>
          <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-tight">{STEP_META.website.title}</h1>
          <p className="m-0 text-base text-ob-muted">{STEP_META.website.lead}</p>
        </div>

        <form className={card} onSubmit={onSubmit} noValidate>
          <Field label="Website" htmlFor="website" error={error ?? undefined} hint="Your shop, booking page or company site.">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <TextInput
                id="website"
                type="url"
                inputMode="url"
                autoComplete="url"
                autoFocus
                value={website}
                onValueChange={setWebsite}
                onBlur={() => setWebsite(withScheme(website))}
                placeholder="https://yourshop.com"
              />
              <button type="submit" className={cn(button(), "shrink-0")} disabled={!!busy}>
                {busy === "site" ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue
                {busy !== "site" && <ArrowRight size={16} />}
              </button>
            </div>
          </Field>
        </form>

        <p className="m-0 text-[13px] text-ob-muted">
          No website yet?{" "}
          <button
            type="button"
            className="font-bold text-ob-primary underline-offset-2 hover:underline disabled:opacity-55"
            disabled={!!busy}
            onClick={() => {
              setWebsite("");
              save("", "none");
            }}
          >
            {busy === "none" ? "Saving…" : "Continue without one"}
          </button>
        </p>

        {saved && saved !== website && website && (
          <Alert tone="info">Changing your website reads the new one. What you already filled in stays as it is.</Alert>
        )}
      </main>
    </div>
  );
}
