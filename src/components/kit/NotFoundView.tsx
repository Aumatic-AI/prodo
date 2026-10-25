import Link from "next/link";
import { Compass } from "lucide-react";
import { LogoMark } from "./Logo";
import { button } from "./styles";

/** "Page not found", used inside the app and on its own. */
export function NotFoundView({ standalone = false }: { standalone?: boolean }) {
  return (
    <div className={standalone ? "flex min-h-screen items-center justify-center bg-ob-bg px-4 font-ob text-ob-ink" : "flex min-h-[70vh] items-center justify-center px-4 font-ob"}>
      <div className="flex max-w-[440px] flex-col items-center gap-5 text-center animate-in fade-in zoom-in-95 duration-300">
        <span className="relative">
          <LogoMark size={64} />
          <span className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full border-4 border-ob-bg bg-ob-surface text-ob-primary">
            <Compass size={15} />
          </span>
        </span>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-ob-primary">404</span>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">We couldn&apos;t find that page</h1>
          <p className="m-0 text-[15px] text-ob-muted">The link may be old, or the item was deleted.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href="/week" className={button()}>
            Go to This week
          </Link>
          <Link href="/media" className={button({ variant: "secondary" })}>
            Open Media
          </Link>
        </div>
      </div>
    </div>
  );
}
