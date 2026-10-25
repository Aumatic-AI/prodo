import type { ReactNode } from "react";
import { CalendarCheck, Check, Instagram, Linkedin, Sparkles } from "lucide-react";
import { Logo } from "@/components/kit/Logo";
import { cn } from "@/lib/utils";

/** Card that slides in after `delay` ms. */
function Float({ delay, className, children }: { delay: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-ob-lg border border-white/10 bg-white/[0.07] p-4 shadow-ob-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-fill-mode:both]",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const PILLARS = [
  { name: "Proof", share: 35 },
  { name: "How it works", share: 25 },
  { name: "Offers", share: 20 },
  { name: "Behind the scenes", share: 20 },
];

/** Left half of the login page: what Prodo does, shown as a week of work in progress. */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ob-dark text-ob-on-dark lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Soft light behind the cards */}
      <div className="pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full bg-ob-primary/50 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 right-0 size-[360px] rounded-full bg-ob-primary/30 blur-[120px]" aria-hidden="true" />

      <Logo tone="onDark" size="lg" className="relative" />

      <div className="relative flex flex-col gap-10">
        <div className="flex max-w-[460px] flex-col gap-4">
          <h2 className="m-0 text-[40px] font-extrabold leading-[1.08] tracking-tight">
            Your content team,
            <br />
            <span className="text-ob-primary-soft">on autopilot.</span>
          </h2>
          <p className="m-0 text-base leading-relaxed text-ob-on-dark-soft">
            Prodo learns your brand, plans the week, makes the posts and publishes them. You just approve.
          </p>
        </div>

        <div className="grid max-w-[520px] grid-cols-[1.15fr_1fr] gap-3.5" aria-hidden="true">
          <Float delay={150} className="row-span-2 flex flex-col gap-3">
            <div className="aspect-[4/5] overflow-hidden rounded-ob-md bg-gradient-to-br from-ob-primary to-ob-primary-ink p-4">
              <div className="flex h-full flex-col justify-between">
                <span className="w-fit rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ob-ink">Ends Sunday</span>
                <div className="flex flex-col gap-2">
                  <span className="text-xl font-extrabold leading-tight">20% off every spring service</span>
                  <span className="w-fit rounded-ob bg-white px-3 py-1.5 text-xs font-bold text-ob-primary">Book now</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex gap-1.5 text-ob-on-dark-soft">
                <Instagram size={15} />
                <Linkedin size={15} />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-ob-success/25 px-2 py-0.5 text-[11px] font-bold text-ob-success-soft">
                <Check size={11} /> QA 8.6
              </span>
            </div>
          </Float>

          <Float delay={350} className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-ob-on-dark-soft">
              <CalendarCheck size={14} /> Next week
            </span>
            <span className="text-[15px] font-bold">9 posts planned</span>
            <div className="flex flex-col gap-1.5">
              {PILLARS.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-[11px] text-ob-on-dark-soft">
                  <span className="w-[86px] truncate">{p.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-ob-primary-soft" style={{ width: `${p.share * 2.4}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </Float>

          <Float delay={550} className="flex items-start gap-3">
            <span className="relative mt-1 flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ob-primary-soft opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-ob-primary-soft" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-bold">
                <Sparkles size={13} /> Producer
              </span>
              <span className="text-xs text-ob-on-dark-soft">Making 3 videos with your real photos…</span>
            </span>
          </Float>
        </div>
      </div>

      <p className="relative m-0 text-xs text-ob-on-dark-soft/70">Plans · Creates · Checks · Publishes · Learns</p>
    </aside>
  );
}
