import { cva, type VariantProps } from "class-variance-authority";

// Shared Tailwind classes for the onboarding UI. Colours come from the ob-* theme tokens.

export const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-ob-focus";

/** Text inputs, textareas and selects. Turns red inside an invalid Field. */
export const control =
  "w-full min-h-11 rounded-ob border border-ob-line-strong bg-ob-surface px-3.5 py-2.5 text-[15px] text-ob-ink " +
  "placeholder:text-ob-faint transition-[border-color,box-shadow] duration-150 hover:border-ob-muted " +
  "focus:border-ob-primary focus:outline-none focus:ring-4 focus:ring-ob-focus " +
  "group-data-[invalid=true]/field:border-ob-danger";

export const button = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`,
  {
    variants: {
      variant: {
        primary: "bg-ob-primary text-ob-on-primary shadow-ob-sm enabled:hover:bg-ob-primary-hover",
        secondary: "border border-ob-line bg-ob-surface text-ob-ink enabled:hover:border-ob-line-strong enabled:hover:bg-ob-sunken",
        ghost: "text-ob-primary enabled:hover:bg-ob-primary-soft",
        danger: "text-ob-muted enabled:hover:bg-ob-danger-soft enabled:hover:text-ob-danger",
        dangerSolid: "bg-ob-danger text-ob-on-primary shadow-ob-sm enabled:hover:brightness-95",
        /** Grey text button, for low-priority actions next to content */
        quiet: "text-ob-muted enabled:hover:bg-ob-sunken enabled:hover:text-ob-ink",
      },
      size: {
        md: "min-h-11 rounded-ob-md px-[18px] text-[15px]",
        sm: "min-h-9 rounded-ob px-3 text-sm",
        xs: "min-h-8 rounded-ob px-2.5 text-[13px]",
        icon: "size-9 shrink-0 rounded-ob",
        iconSm: "size-8 shrink-0 rounded-ob",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonStyle = VariantProps<typeof button>;

/** Button that opens a dropdown. Looks like a text input. */
export const trigger = `${control} flex cursor-pointer items-center justify-between gap-2 text-left data-[popup-open]:border-ob-primary data-[popup-open]:ring-4 data-[popup-open]:ring-ob-focus`;

/** Any floating panel (dropdowns, calendar). Rendered in a portal, so it sets its own font. */
export const floating =
  "z-50 rounded-ob-md border border-ob-line bg-ob-surface font-ob text-ob-ink shadow-ob-md outline-none " +
  "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0";

/** Dropdown panel, as wide as its trigger. Base UI sets --anchor-width and --available-height. */
export const popup = `${floating} flex max-h-[min(var(--available-height),340px)] w-[var(--anchor-width)] min-w-56 flex-col overflow-hidden`;

/** One row in a dropdown list. */
export const option =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-ob px-3 py-2 text-sm text-ob-ink outline-none data-[highlighted]:bg-ob-primary-soft data-[selected]:font-semibold";

export const card = "flex flex-col gap-5 rounded-ob-lg border border-ob-line bg-ob-surface p-6 shadow-ob-xs";
export const label = "text-sm font-semibold text-ob-ink";
export const hint = "text-[13px] text-ob-muted";
export const sectionTitle = "m-0 text-lg font-bold tracking-tight";
export const numberBadge = "grid size-6 shrink-0 place-items-center rounded-full bg-ob-primary-soft text-xs font-bold text-ob-primary";

/** Page width shared by the top bar, stepper, content and footer. */
export const container = "mx-auto w-full max-w-[1180px] px-4 sm:px-6";

/** Two or more fields side by side, stacking on small screens. */
export const row = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4";
