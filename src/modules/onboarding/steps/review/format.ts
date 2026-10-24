// Plain-language values for the Review step

export const labelOf = (options: readonly { value: string; label: string }[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? "";

export function money(price: number | null | undefined, currency: string): string {
  if (price === null || price === undefined) return "";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

/** "2026-10-24" → "24 Oct 2026" */
export function day(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
