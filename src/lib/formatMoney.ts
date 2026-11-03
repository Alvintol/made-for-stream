// Agreement and milestone amounts use major currency units (for example, dollars).
export const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

// For a graph's axis, where "$1.2K" fits and "$1,200.00" doesn't.
export const formatCompactMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumSignificantDigits: 3,
  }).format(amount);
