// Currencies offered in the app, and the usual currency of a country.

const EURO_COUNTRIES = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];

const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR"])),
  US: "USD",
  GB: "GBP",
  IN: "INR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  AU: "AUD",
  NZ: "NZD",
  CA: "CAD",
  SG: "SGD",
  CH: "CHF",
  JP: "JPY",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
  IL: "ILS",
  TR: "TRY",
  EG: "EGP",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NG: "NGN",
  KE: "KES",
  MY: "MYR",
  TH: "THB",
  ID: "IDR",
  PH: "PHP",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "AED",
  SAR: "SAR",
  QAR: "QAR",
  AUD: "A$",
  NZD: "NZ$",
  CAD: "C$",
  SGD: "S$",
  CHF: "CHF",
  JPY: "¥",
  ZAR: "R",
  BRL: "R$",
  MXN: "MX$",
  ILS: "₪",
  TRY: "₺",
  EGP: "E£",
  PKR: "Rs",
  BDT: "৳",
  LKR: "Rs",
  NGN: "₦",
  KES: "KSh",
  MYR: "RM",
  THB: "฿",
  IDR: "Rp",
  PHP: "₱",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
};

export const CURRENCY_OPTIONS = Object.keys(CURRENCY_SYMBOL).map((c) => ({ value: c, label: c }));

/** Currency for new prices, from the main (first) country. */
export function currencyFor(countries: string[]): string {
  return COUNTRY_CURRENCY[countries[0] ?? ""] ?? "USD";
}
