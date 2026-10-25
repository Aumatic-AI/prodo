"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/kit/Alert";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { Logo } from "@/components/kit/Logo";
import { button, focusRing } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { BrandPanel } from "./BrandPanel";

/** Plain messages for the sign-in errors people actually hit. */
function signInMessage(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(raw)) return "This email isn't confirmed yet. Check your inbox for the confirmation link.";
  if (/rate limit|too many/i.test(raw)) return "Too many attempts. Wait a minute, then try again.";
  return "We couldn't sign you in. Try again in a moment.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(signInMessage(authError.message));
      setLoading(false);
      return;
    }

    // Back to the page that sent us here; only same-site paths
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/week");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen bg-ob-bg font-ob text-ob-ink lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="flex w-full max-w-[400px] flex-col gap-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Logo className="lg:hidden" />

          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] font-extrabold leading-tight tracking-tight">Welcome back</h1>
            <p className="m-0 text-[15px] text-ob-muted">Sign in to see this week&apos;s plan and what needs your approval.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onValueChange={setEmail}
                required
                autoFocus
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <TextInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onValueChange={setPassword}
                  required
                  placeholder="Your password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={cn(
                    "absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-ob text-ob-muted transition-colors hover:bg-ob-sunken hover:text-ob-ink",
                    focusRing
                  )}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && <Alert tone="error">{error}</Alert>}

            <button type="submit" disabled={loading} className={cn(button(), "group w-full")}>
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="m-0 text-[13px] text-ob-faint">Your login is set up by your Prodo admin. Forgot your password? Ask them to send a reset link.</p>
        </div>
      </main>
    </div>
  );
}
